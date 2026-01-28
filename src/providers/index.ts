import type { Config } from '../config/schema.js';
import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

export * from './types.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OllamaProvider } from './ollama.js';

/**
 * Provider manager - creates and caches provider instances
 */
export class ProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private config: Config;
  private defaultProvider: string;

  constructor(config: Config) {
    this.config = config;
    this.defaultProvider = config.providers.default;
  }

  /**
   * Get the default provider
   */
  getDefault(): LLMProvider {
    return this.get(this.defaultProvider);
  }

  /**
   * Get a specific provider by name
   */
  get(name: string): LLMProvider {
    // Return cached if exists
    if (this.providers.has(name)) {
      return this.providers.get(name)!;
    }

    // Create new provider
    const provider = this.createProvider(name);
    this.providers.set(name, provider);
    return provider;
  }

  /**
   * Create a provider instance
   */
  private createProvider(name: string): LLMProvider {
    switch (name) {
      case 'openai':
        if (!this.config.providers.openai?.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        return new OpenAIProvider(this.config);

      case 'anthropic':
        if (!this.config.providers.anthropic?.apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        return new AnthropicProvider(this.config);

      case 'ollama':
        if (!this.config.providers.ollama) {
          throw new Error('Ollama not configured');
        }
        return new OllamaProvider(this.config);

      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  /**
   * Get list of available providers
   */
  getAvailable(): string[] {
    const available: string[] = [];
    
    if (this.config.providers.openai?.apiKey) {
      available.push('openai');
    }
    if (this.config.providers.anthropic?.apiKey) {
      available.push('anthropic');
    }
    if (this.config.providers.ollama) {
      available.push('ollama');
    }
    
    return available;
  }

  /**
   * Check if a provider is available
   */
  async checkAvailability(name: string): Promise<boolean> {
    try {
      const provider = this.get(name);
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Get the best provider for embeddings
   */
  getEmbeddingProvider(): LLMProvider {
    const embeddingsConfig = this.config.providers.embeddings;
    
    if (embeddingsConfig?.provider) {
      return this.get(embeddingsConfig.provider);
    }
    
    // Prefer Ollama for local embeddings, then OpenAI
    if (this.config.providers.ollama) {
      return this.get('ollama');
    }
    if (this.config.providers.openai?.apiKey) {
      return this.get('openai');
    }
    
    throw new Error('No embedding provider available');
  }
}

/**
 * Create a provider manager instance
 */
export function createProviderManager(config: Config): ProviderManager {
  return new ProviderManager(config);
}
