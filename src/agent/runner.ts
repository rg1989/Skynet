import type { Config } from '../config/schema.js';
import type { Skill, SkillContext, SkillResult, SessionMessage, WSEventType } from '../types/index.js';
import type { LLMProvider, StreamChunk } from '../providers/types.js';
import type { ProviderManager } from '../providers/index.js';
import { SessionManager } from './session.js';
import { buildContext, addToolResult, addAssistantToolCalls, type ToolsMode } from './context.js';
import { toolParser, type ParsedToolCall } from './tool-parser.js';
import { getRuntimeConfig } from '../config/runtime.js';

/**
 * Agent Runner - orchestrates message processing and tool execution
 */

export interface AgentRunParams {
  message: string;
  sessionKey: string;
  provider?: LLMProvider;
  persona?: string; // Persona ID (e.g., 'hawking', 'default')
  media?: {
    type: string;
    base64?: string;
    path?: string;
  }[];
}

export interface AgentRunResult {
  runId: string;
  status: 'success' | 'error' | 'cancelled';
  response?: string;
  error?: string;
  toolsUsed: string[];
  tokensUsed?: number;
  durationMs: number;
}

export type BroadcastFn = (type: WSEventType, payload: unknown) => void;

export class AgentRunner {
  private config: Config;
  private sessionManager: SessionManager;
  private skills: Map<string, Skill> = new Map();
  private providerManager: ProviderManager;
  private broadcast: BroadcastFn;
  private runningTasks: Map<string, AbortController> = new Map();

  constructor(
    config: Config,
    providerManager: ProviderManager,
    broadcast: BroadcastFn
  ) {
    this.config = config;
    this.sessionManager = new SessionManager(config.dataDir);
    this.providerManager = providerManager;
    this.broadcast = broadcast;
  }

  /**
   * Get the current default provider (respects runtime config changes)
   */
  private getCurrentProvider(): LLMProvider {
    const runtimeConfig = getRuntimeConfig();
    const currentProviderName = runtimeConfig.getCurrentProvider();
    return this.providerManager.get(currentProviderName);
  }

  /**
   * Register a skill
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Register multiple skills
   */
  registerSkills(skills: Skill[]): void {
    for (const skill of skills) {
      this.registerSkill(skill);
    }
  }

  /**
   * Get all registered skills
   */
  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get tools mode from runtime config
   */
  private getToolsMode(): ToolsMode {
    // Use runtime config which respects UI changes
    return getRuntimeConfig().getToolsMode();
  }

  /**
   * Run the agent with a message
   */
  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const abortController = new AbortController();
    
    this.runningTasks.set(runId, abortController);

    try {
      // Broadcast start
      this.broadcast('agent:start', {
        runId,
        sessionKey: params.sessionKey,
        prompt: params.message.slice(0, 100) + (params.message.length > 100 ? '...' : ''),
      });

      // Load session
      const session = this.sessionManager.load(params.sessionKey);

      // Add user message to session
      const userMessage: SessionMessage = {
        role: 'user',
        content: params.message,
        timestamp: Date.now(),
        media: params.media,
      };
      session.messages.push(userMessage);

      // Save immediately so user message is persisted even if agent takes time
      // This ensures the message appears when switching back to the chat
      this.sessionManager.save(session);

      // Get tools mode
      const toolsMode = this.getToolsMode();
      const toolsEnabled = toolsMode !== 'disabled';

      // Build context with tool instructions if needed
      const context = buildContext({
        session,
        config: this.config,
        skills: this.getSkills(),
        toolsEnabled,
        toolsMode,
        persona: params.persona,
      });

      // Get provider (dynamically from runtime config)
      const provider = params.provider || this.getCurrentProvider();

      // Run agent loop with hybrid tool detection
      let response = '';
      let messages = context.messages;
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (iterations < maxIterations) {
        iterations++;

        // Check for cancellation
        if (abortController.signal.aborted) {
          throw new Error('Cancelled');
        }

        // Stream response
        let currentResponse = '';
        let nativeToolCalls: StreamChunk['toolCalls'] = undefined;

        // Only pass tools to API if using native or hybrid mode
        const useNativeTools = toolsMode === 'native' || toolsMode === 'hybrid';

        for await (const chunk of provider.chatStream({
          messages,
          tools: useNativeTools ? context.tools : undefined,
          maxTokens: context.maxOutputTokens,
        })) {
          if (chunk.delta) {
            currentResponse += chunk.delta;
            this.broadcast('agent:token', { runId, delta: chunk.delta });
          }

          if (chunk.toolCalls) {
            nativeToolCalls = chunk.toolCalls;
          }

          if (chunk.finishReason) {
            break;
          }
        }

        // HYBRID TOOL DETECTION
        // Step 1: Check for native API tool calls
        if (nativeToolCalls && nativeToolCalls.length > 0) {
          // First, add assistant message with tool_use blocks (required by Anthropic)
          messages = addAssistantToolCalls(
            messages,
            nativeToolCalls,
            currentResponse || undefined // Include any text before tool calls
          );

          // Execute tool calls and add results
          for (const call of nativeToolCalls) {
            toolsUsed.push(call.name);

            // Broadcast tool start
            this.broadcast('agent:tool_start', {
              runId,
              name: call.name,
              params: call.arguments,
            });

            // Execute tool
            const result = await this.executeSkill(call.name, call.arguments, params.sessionKey);

            // Broadcast tool end
            this.broadcast('agent:tool_end', {
              runId,
              name: call.name,
              result: result.success ? result.data : result.error,
              media: result.media,
            });

            // Add tool result to messages
            messages = addToolResult(
              messages,
              call.id,
              JSON.stringify(result.success ? result.data : { error: result.error })
            );
          }
          
          // Continue loop to get follow-up response
          continue;
        }

        // Step 2: Check for text-based tool calls (hybrid or text mode)
        if (toolsMode === 'hybrid' || toolsMode === 'text') {
          const textToolCalls = toolParser.findToolCalls(currentResponse);
          
          if (textToolCalls.length > 0) {
            // Execute text-based tool calls
            const toolResults = await this.executeTextToolCalls(
              textToolCalls,
              runId,
              params.sessionKey,
              toolsUsed
            );

            // Remove tool call syntax from response for display
            const cleanedResponse = toolParser.removeToolCalls(currentResponse);
            
            // Add assistant message with cleaned response
            if (cleanedResponse) {
              messages = [
                ...messages,
                { role: 'assistant' as const, content: cleanedResponse },
              ];
            }

            // Add tool results as a system message for context
            const resultsMessage = toolResults
              .map(r => `[Tool: ${r.name}]\n${r.success ? r.output : `Error: ${r.error}`}`)
              .join('\n\n');

            messages = [
              ...messages,
              { 
                role: 'system' as const, 
                content: `Tool execution results:\n\n${resultsMessage}\n\nNow provide a natural response incorporating these results.` 
              },
            ];

            // Continue loop to get follow-up response
            continue;
          }
        }

        // Step 3: Check for JSON tool call in response (fallback for models that output JSON)
        const extractedText = this.extractTextFromToolCallJson(currentResponse);
        if (extractedText) {
          response = extractedText;
        } else {
          response = currentResponse;
        }

        // No tool calls found, we have the final response
        break;
      }

      // Add assistant response to session
      if (response) {
        const assistantMessage: SessionMessage = {
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        };
        session.messages.push(assistantMessage);
      }

      // Save session
      this.sessionManager.save(session);

      // Broadcast end
      this.broadcast('agent:end', {
        runId,
        status: 'success',
        toolsUsed,
      });

      return {
        runId,
        status: 'success',
        response,
        toolsUsed,
        durationMs: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.broadcast('agent:end', {
        runId,
        status: 'error',
        error: errorMessage,
      });

      return {
        runId,
        status: error instanceof Error && error.message === 'Cancelled' ? 'cancelled' : 'error',
        error: errorMessage,
        toolsUsed,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.runningTasks.delete(runId);
    }
  }

  /**
   * Execute text-based tool calls from parser
   */
  private async executeTextToolCalls(
    toolCalls: ParsedToolCall[],
    runId: string,
    sessionKey: string,
    toolsUsed: string[]
  ): Promise<Array<{ name: string; success: boolean; output?: string; error?: string }>> {
    const results: Array<{ name: string; success: boolean; output?: string; error?: string }> = [];

    for (const call of toolCalls) {
      toolsUsed.push(call.name);

      // Broadcast tool start
      this.broadcast('agent:tool_start', {
        runId,
        name: call.name,
        params: call.arguments,
      });

      // Execute tool
      const result = await this.executeSkill(call.name, call.arguments, sessionKey);

      // Broadcast tool end
      this.broadcast('agent:tool_end', {
        runId,
        name: call.name,
        result: result.success ? result.data : result.error,
        media: result.media,
      });

      results.push({
        name: call.name,
        success: result.success,
        output: result.success ? JSON.stringify(result.data) : undefined,
        error: result.error,
      });
    }

    return results;
  }

  /**
   * Execute a skill
   */
  private async executeSkill(
    name: string,
    params: Record<string, unknown>,
    sessionKey: string
  ): Promise<SkillResult> {
    const skill = this.skills.get(name);
    
    if (!skill) {
      return {
        success: false,
        error: `Unknown skill: ${name}`,
      };
    }

    const context: SkillContext = {
      workspaceRoot: process.cwd(),
      sessionKey,
      config: this.config,
      broadcast: (event, payload) => this.broadcast(event as WSEventType, payload),
    };

    try {
      return await skill.execute(params, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract text from tool call JSON if the model output it as plain text
   * Some models output tool calls as JSON text instead of using proper tool calling
   * This handles patterns like:
   * - {"name": "speak", "arguments": {"text": "Hello"}}
   * - {"tool": "respond", "args": {"message": "Hello"}}
   */
  private extractTextFromToolCallJson(content: string): string | null {
    if (!content) return null;
    
    const trimmed = content.trim();
    
    // Check if content looks like a JSON object with tool call structure
    if (!trimmed.startsWith('{')) {
      return null;
    }
    
    // Must have either "name" or "tool" key
    if (!trimmed.includes('"name"') && !trimmed.includes('"tool"')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      
      // Get the tool name (supports both formats)
      const toolName = parsed.name || parsed.tool;
      
      // Get the arguments (supports both formats)
      const args = parsed.arguments || parsed.args || {};
      
      // Check for common tool call patterns with text output
      if (toolName && typeof args === 'object') {
        // Look for text/content in arguments
        // Common patterns: speak, say, respond, answer, reply
        const textContent = args.text 
          || args.content 
          || args.message
          || args.response
          || args.answer
          || args.reply;
        
        if (typeof textContent === 'string') {
          return textContent;
        }
        
        // If the tool is "speak" or similar and has any string value, extract it
        const speechTools = ['speak', 'say', 'respond', 'answer', 'reply', 'talk'];
        if (speechTools.includes(String(toolName).toLowerCase())) {
          // Find the first string value in arguments
          for (const value of Object.values(args)) {
            if (typeof value === 'string' && value.length > 0) {
              return value;
            }
          }
        }
      }
    } catch {
      // Not valid JSON, return null
    }

    return null;
  }

  /**
   * Cancel a running task
   */
  cancel(runId: string): boolean {
    const controller = this.runningTasks.get(runId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }
}
