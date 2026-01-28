import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createReadStream } from 'fs';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types.js';
import { skillToOpenAITool } from './types.js';
import type { Config } from '../config/schema.js';

/**
 * OpenAI Provider implementation
 * Supports: GPT-4o, GPT-4o-mini, Whisper, text-embedding-3-small
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;
  private visionModel: string;
  private embeddingModel: string;

  constructor(config: Config) {
    const openaiConfig = config.providers.openai;
    if (!openaiConfig?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.client = new OpenAI({ apiKey: openaiConfig.apiKey });
    this.model = openaiConfig.model || 'gpt-4o';
    this.visionModel = openaiConfig.visionModel || 'gpt-4o';
    this.embeddingModel = config.providers.embeddings?.model || 'text-embedding-3-small';
  }

  private convertMessages(messages: ChatParams['messages']): ChatCompletionMessageParam[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system' as const, content: m.content };
      }
      if (m.role === 'user') {
        return { role: 'user' as const, content: m.content };
      }
      if (m.role === 'assistant') {
        return { role: 'assistant' as const, content: m.content };
      }
      if (m.role === 'tool') {
        return { 
          role: 'tool' as const, 
          content: m.content,
          tool_call_id: m.toolCallId || '',
        };
      }
      return { role: 'user' as const, content: m.content };
    });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const tools = params.tools?.map(skillToOpenAITool);
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(params.messages),
      tools: tools as OpenAI.ChatCompletionTool[] | undefined,
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 0.7,
    });

    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content || undefined,
      toolCalls: message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 
                    choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  async *chatStream(params: ChatParams): AsyncIterable<StreamChunk> {
    const tools = params.tools?.map(skillToOpenAITool);
    
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(params.messages),
      tools: tools as OpenAI.ChatCompletionTool[] | undefined,
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 0.7,
      stream: true,
    });

    const toolCallsAccumulator: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        yield { delta: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsAccumulator.has(tc.index)) {
            toolCallsAccumulator.set(tc.index, { id: '', name: '', arguments: '' });
          }
          const acc = toolCallsAccumulator.get(tc.index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;
      if (finishReason) {
        const toolCalls = toolCallsAccumulator.size > 0 
          ? Array.from(toolCallsAccumulator.values()).map(tc => ({
              id: tc.id,
              name: tc.name,
              arguments: JSON.parse(tc.arguments || '{}'),
            }))
          : undefined;

        yield {
          finishReason: finishReason === 'tool_calls' ? 'tool_calls' : 
                       finishReason === 'length' ? 'length' : 'stop',
          toolCalls,
        };
      }
    }
  }

  async analyzeImage(imageBase64: string, prompt: string, mimeType = 'image/png'): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || '';
  }

  async transcribe(audioPath: string): Promise<string> {
    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(audioPath),
    });

    return response.text;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
