import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types.js';
import { skillToAnthropicTool } from './types.js';
import type { Config } from '../config/schema.js';

/**
 * Anthropic Provider implementation
 * Supports: Claude Sonnet 4, Claude Opus 4
 * Note: Uses OpenAI for embeddings and transcription (Anthropic doesn't have these)
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;
  private config: Config;

  constructor(config: Config) {
    const anthropicConfig = config.providers.anthropic;
    if (!anthropicConfig?.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    this.client = new Anthropic({ apiKey: anthropicConfig.apiKey });
    this.model = anthropicConfig.model || 'claude-sonnet-4-20250514';
    this.config = config;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const tools = params.tools?.map(skillToAnthropicTool);
    
    // Extract system message
    const systemMessage = params.messages.find((m: ChatParams['messages'][0]) => m.role === 'system')?.content;
    const otherMessages = params.messages.filter((m: ChatParams['messages'][0]) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens || 4096,
      system: systemMessage,
      messages: otherMessages.map((m: ChatParams['messages'][0]) => {
        // Handle tool results (sent as user messages with tool_result content)
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId || '',
              content: m.content,
            }],
          };
        }
        // Handle assistant messages with tool calls
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const content: Array<Anthropic.TextBlock | Anthropic.ToolUseBlock> = [];
          // Add text content if present
          if (m.content) {
            content.push({ type: 'text' as const, text: m.content, citations: null });
          }
          // Add tool_use blocks
          for (const tc of m.toolCalls) {
            content.push({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
          return {
            role: 'assistant' as const,
            content,
          };
        }
        // Regular text messages
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
      tools: tools as Anthropic.Tool[] | undefined,
    });

    // Extract content and tool calls
    let content: string | undefined;
    const toolCalls: ChatResponse['toolCalls'] = [];

    for (const block of response.content as Array<Anthropic.ContentBlock>) {
      if (block.type === 'text') {
        content = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 
                    response.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    const tools = params.tools?.map(skillToAnthropicTool);
    
    // Extract system message
    const systemMessage = params.messages.find((m: ChatParams['messages'][0]) => m.role === 'system')?.content;
    const otherMessages = params.messages.filter((m: ChatParams['messages'][0]) => m.role !== 'system');

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens || 4096,
      system: systemMessage,
      messages: otherMessages.map((m: ChatParams['messages'][0]) => {
        // Handle tool results (sent as user messages with tool_result content)
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId || '',
              content: m.content,
            }],
          };
        }
        // Handle assistant messages with tool calls
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const content: Array<Anthropic.TextBlock | Anthropic.ToolUseBlock> = [];
          // Add text content if present
          if (m.content) {
            content.push({ type: 'text' as const, text: m.content, citations: null });
          }
          // Add tool_use blocks
          for (const tc of m.toolCalls) {
            content.push({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
          return {
            role: 'assistant' as const,
            content,
          };
        }
        // Regular text messages
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
      tools: tools as Anthropic.Tool[] | undefined,
    });

    const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];
    let currentToolUse: { id: string; name: string; input: string } | null = null;

    for await (const event of stream as AsyncIterable<Anthropic.MessageStreamEvent>) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { delta: event.delta.text };
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          toolCalls.push({
            id: currentToolUse.id,
            name: currentToolUse.name,
            arguments: JSON.parse(currentToolUse.input || '{}'),
          });
          currentToolUse = null;
        }
      } else if (event.type === 'message_stop') {
        yield {
          finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      }
    }
  }

  async analyzeImage(imageBase64: string, prompt: string, mimeType = 'image/png'): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  async transcribe(_audioPath: string): Promise<string> {
    // Anthropic doesn't have a transcription API
    // Fall back to OpenAI if available, otherwise throw
    if (this.config.providers.openai?.apiKey) {
      const { OpenAIProvider } = await import('./openai.js');
      const openai = new OpenAIProvider(this.config);
      return openai.transcribe(_audioPath);
    }
    throw new Error('Transcription not available: Anthropic does not support audio transcription. Configure OpenAI for this feature.');
  }

  async embed(_text: string): Promise<number[]> {
    // Anthropic doesn't have an embeddings API
    // Fall back to OpenAI if available, otherwise throw
    if (this.config.providers.openai?.apiKey) {
      const { OpenAIProvider } = await import('./openai.js');
      const openai = new OpenAIProvider(this.config);
      return openai.embed(_text);
    }
    throw new Error('Embeddings not available: Anthropic does not support embeddings. Configure OpenAI or Ollama for this feature.');
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple test - just try to list models or make a minimal request
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
