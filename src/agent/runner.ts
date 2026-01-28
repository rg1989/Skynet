import type { Config } from '../config/schema.js';
import type { Skill, SkillContext, SkillResult, SessionMessage, WSEventType } from '../types/index.js';
import type { LLMProvider, StreamChunk } from '../providers/types.js';
import { SessionManager } from './session.js';
import { buildContext, addToolResult } from './context.js';

/**
 * Agent Runner - orchestrates message processing and tool execution
 */

export interface AgentRunParams {
  message: string;
  sessionKey: string;
  provider?: LLMProvider;
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
  private defaultProvider: LLMProvider;
  private broadcast: BroadcastFn;
  private runningTasks: Map<string, AbortController> = new Map();

  constructor(
    config: Config,
    defaultProvider: LLMProvider,
    broadcast: BroadcastFn
  ) {
    this.config = config;
    this.sessionManager = new SessionManager(config.dataDir);
    this.defaultProvider = defaultProvider;
    this.broadcast = broadcast;
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

      // Check if tools are enabled for the current provider
      const providerConfig = this.config.providers[this.config.providers.default as keyof typeof this.config.providers];
      const toolsEnabled = typeof providerConfig === 'object' && providerConfig !== null && 'toolsEnabled' in providerConfig
        ? (providerConfig as { toolsEnabled?: boolean }).toolsEnabled !== false
        : true;

      // Build context
      const context = buildContext({
        session,
        config: this.config,
        skills: this.getSkills(),
        toolsEnabled,
      });

      // Get provider
      const provider = params.provider || this.defaultProvider;

      // Run agent loop
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
        let toolCalls: StreamChunk['toolCalls'] = undefined;

        for await (const chunk of provider.chatStream({
          messages,
          tools: toolsEnabled ? context.tools : undefined,
          maxTokens: context.maxOutputTokens,
        })) {
          if (chunk.delta) {
            currentResponse += chunk.delta;
            this.broadcast('agent:token', { runId, delta: chunk.delta });
          }

          if (chunk.toolCalls) {
            toolCalls = chunk.toolCalls;
          }

          if (chunk.finishReason) {
            break;
          }
        }

        // If tool calls, execute them
        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
            toolsUsed.push(call.name);

            // Broadcast tool start
            this.broadcast('agent:tool_start', {
              runId,
              name: call.name,
              params: call.arguments,
            });

            // Execute tool
            const result = await this.executeSkill(
              call.name,
              call.arguments,
              params.sessionKey
            );

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

          // Continue loop to get next response
          continue;
        }

        // No tool calls, we have the final response
        // Post-process: If the model output a tool call as JSON text (common with some models),
        // try to extract the actual text content
        response = this.extractTextFromToolCallJson(currentResponse) || currentResponse;
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
   */
  private extractTextFromToolCallJson(content: string): string | null {
    if (!content) return null;
    
    const trimmed = content.trim();
    
    // Check if content looks like a JSON tool call
    if (!trimmed.startsWith('{') || !trimmed.includes('"name"')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      
      // Check for common tool call patterns
      if (parsed.name && parsed.arguments) {
        // Look for text/content in arguments (common patterns: speak, say, respond, etc.)
        const textContent = parsed.arguments.text 
          || parsed.arguments.content 
          || parsed.arguments.message
          || parsed.arguments.response;
        
        if (typeof textContent === 'string') {
          return textContent;
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
