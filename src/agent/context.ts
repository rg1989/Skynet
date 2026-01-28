import type { Message, Session, Skill } from '../types/index.js';
import type { Config } from '../config/schema.js';

/**
 * Context builder - assembles messages for LLM
 */

export interface ContextBuildParams {
  session: Session;
  config: Config;
  skills: Skill[];
  maxTokens?: number;
  toolsEnabled?: boolean;
}

export interface BuiltContext {
  messages: Message[];
  tools: Skill[];
  maxOutputTokens: number;
}

/**
 * Build system prompt
 */
function buildSystemPrompt(config: Config, toolsEnabled: boolean): string {
  // If tools are disabled, use a simpler prompt without tool mentions
  if (!toolsEnabled) {
    return config.agent.systemPrompt || `You are Skynet, a helpful personal AI assistant.

Be helpful, accurate, and conversational. Answer questions directly and naturally.
Do not attempt to use tools, functions, or output JSON - just respond in plain text.`;
  }

  const basePrompt = config.agent.systemPrompt || `You are Skynet, a helpful personal AI assistant.

You have access to various tools to help the user with tasks:
- File operations (read, write, edit files)
- Command execution (run shell commands)
- Web browsing (fetch and search the web)
- Vision (take screenshots, photos, analyze images)
- Audio (record, play, speak, transcribe)
- Memory (remember and recall information)

Always be helpful, accurate, and proactive in using your capabilities.
When you need to perform an action, use the appropriate tool.
After completing a task, summarize what was done.`;

  // Add memory context if enabled
  const memorySection = config.agent.memory?.enabled
    ? `\n\nYou have access to a persistent memory system. Use the memory tools to:
- Store important facts the user tells you (remember_fact)
- Recall facts when needed (recall_fact)
- Store longer memories for semantic search (remember)
- Search your memories when relevant (search_memory)`
    : '';

  return basePrompt + memorySection;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Build context for agent execution
 */
export function buildContext(params: ContextBuildParams): BuiltContext {
  const { session, config, skills, toolsEnabled = true } = params;
  
  // Build system prompt
  const systemPrompt = buildSystemPrompt(config, toolsEnabled);
  
  // Start with system message
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
  ];
  
  // Calculate available tokens for history
  const maxContextTokens = params.maxTokens || 100000;
  const reserveForOutput = config.agent.maxTokens || 4096;
  const systemTokens = estimateTokens(systemPrompt);
  const availableForHistory = maxContextTokens - systemTokens - reserveForOutput - 1000; // 1000 buffer
  
  // Add session messages (most recent first, then reverse)
  let historyTokens = 0;
  const historyMessages: Message[] = [];
  
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    const msgTokens = estimateTokens(msg.content);
    
    if (historyTokens + msgTokens > availableForHistory) {
      // Context full, stop adding
      break;
    }
    
    historyMessages.unshift({
      role: msg.role,
      content: msg.content,
      toolCallId: msg.toolCallId,
    });
    historyTokens += msgTokens;
  }
  
  // Add history to messages
  messages.push(...historyMessages);
  
  return {
    messages,
    tools: skills,
    maxOutputTokens: reserveForOutput,
  };
}

/**
 * Add tool result to context
 */
export function addToolResult(
  messages: Message[],
  toolCallId: string,
  result: string
): Message[] {
  return [
    ...messages,
    {
      role: 'tool' as const,
      content: result,
      toolCallId,
    },
  ];
}

/**
 * Add assistant message to context
 */
export function addAssistantMessage(
  messages: Message[],
  content: string
): Message[] {
  return [
    ...messages,
    {
      role: 'assistant' as const,
      content,
    },
  ];
}
