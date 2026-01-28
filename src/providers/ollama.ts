import { Ollama } from 'ollama';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types.js';
import type { Config } from '../config/schema.js';

/**
 * Ollama Provider implementation
 * Supports: llama3.2, llava (vision), nomic-embed-text (embeddings), whisper (transcription)
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: Ollama;
  private model: string;
  private visionModel: string;
  private embeddingModel: string;
  private config: Config;

  constructor(config: Config) {
    const ollamaConfig = config.providers.ollama;
    if (!ollamaConfig) {
      throw new Error('Ollama not configured');
    }

    this.client = new Ollama({ host: ollamaConfig.baseUrl || 'http://localhost:11434' });
    this.model = ollamaConfig.model;
    this.visionModel = ollamaConfig.visionModel || 'llava';
    this.embeddingModel = config.providers.embeddings?.model || 'nomic-embed-text';
    this.config = config;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    // Build tools for Ollama format
    const tools = params.tools?.map(skill => ({
      type: 'function' as const,
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
      },
    }));

    const response = await this.client.chat({
      model: this.model,
      messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools,
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens,
      },
    });

    // Parse tool calls if present
    const toolCalls = response.message.tool_calls?.map(tc => ({
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: tc.function.name,
      arguments: tc.function.arguments as Record<string, unknown>,
    }));

    return {
      content: response.message.content || undefined,
      toolCalls,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
      finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    // Build tools for Ollama format
    const tools = params.tools?.map(skill => ({
      type: 'function' as const,
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
      },
    }));

    const stream = await this.client.chat({
      model: this.model,
      messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools,
      stream: true,
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens,
      },
    });

    let toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

    for await (const chunk of stream) {
      if (chunk.message.content) {
        yield { delta: chunk.message.content };
      }

      if (chunk.message.tool_calls) {
        toolCalls = chunk.message.tool_calls.map(tc => ({
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: tc.function.name,
          arguments: tc.function.arguments as Record<string, unknown>,
        }));
      }

      if (chunk.done) {
        yield {
          finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      }
    }
  }

  async analyzeImage(imageBase64: string, prompt: string, _mimeType = 'image/png'): Promise<string> {
    const response = await this.client.chat({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [imageBase64],
        },
      ],
    });

    return response.message.content || '';
  }

  async transcribe(audioPath: string): Promise<string> {
    // Try to use local whisper model in Ollama if available
    // Otherwise fall back to OpenAI
    try {
      // Check if whisper model exists
      const models = await this.client.list();
      const hasWhisper = models.models.some(m => m.name.includes('whisper'));
      
      if (hasWhisper) {
        // Ollama doesn't have native whisper support yet
        // This is a placeholder for when it does
        throw new Error('Ollama whisper not yet supported');
      }
    } catch {
      // Fall back to OpenAI if available
      if (this.config.providers.openai?.apiKey) {
        const { OpenAIProvider } = await import('./openai.js');
        const openai = new OpenAIProvider(this.config);
        return openai.transcribe(audioPath);
      }
    }
    
    throw new Error('Transcription not available: Configure OpenAI for audio transcription.');
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings({
      model: this.embeddingModel,
      prompt: text,
    });

    return response.embedding;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }
}
