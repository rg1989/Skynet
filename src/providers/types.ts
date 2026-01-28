import type { Message, ToolCall, TokenUsage, Skill } from '../types/index.js';

/**
 * LLM Provider types
 */

export interface ChatParams {
  messages: Message[];
  tools?: Skill[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  delta?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length';
}

/**
 * Unified LLM Provider interface
 */
export interface LLMProvider {
  readonly name: string;
  
  /**
   * Standard chat completion
   */
  chat(params: ChatParams): Promise<ChatResponse>;
  
  /**
   * Streaming chat completion
   */
  chatStream(params: ChatParams): AsyncIterable<StreamChunk>;
  
  /**
   * Vision: analyze an image with a prompt
   */
  analyzeImage(imageBase64: string, prompt: string, mimeType?: string): Promise<string>;
  
  /**
   * Transcribe audio to text
   */
  transcribe(audioPath: string): Promise<string>;
  
  /**
   * Generate embeddings for text (for memory system)
   */
  embed(text: string): Promise<number[]>;
  
  /**
   * Check if provider is available/configured
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Convert Skill to OpenAI tool format
 */
export function skillToOpenAITool(skill: Skill): object {
  return {
    type: 'function',
    function: {
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters,
    },
  };
}

/**
 * Convert Skill to Anthropic tool format
 */
export function skillToAnthropicTool(skill: Skill): object {
  return {
    name: skill.name,
    description: skill.description,
    input_schema: skill.parameters,
  };
}
