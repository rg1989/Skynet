import type { Config } from '../config/schema.js';
import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { getRuntimeConfig } from '../config/runtime.js';

export * from './types.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OllamaProvider } from './ollama.js';

/**
 * Provider manager - creates and caches provider instances
 */
export class ProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private baseConfig: Config;
  private defaultProvider: string;

  constructor(config: Config) {
    this.baseConfig = config;
    this.defaultProvider = config.providers.default;
  }

  /**
   * Get the effective config (with runtime overrides applied)
   */
  private getEffectiveConfig(): Config {
    try {
      return getRuntimeConfig().getConfig();
    } catch {
      // Runtime config not initialized yet, use base config
      return this.baseConfig;
    }
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
    const config = this.getEffectiveConfig();
    
    switch (name) {
      case 'openai': {
        const apiKey = config.providers.openai?.apiKey;
        if (!apiKey || apiKey.startsWith('${')) {
          throw new Error('OpenAI API key not configured');
        }
        return new OpenAIProvider(config);
      }

      case 'anthropic': {
        const apiKey = config.providers.anthropic?.apiKey;
        if (!apiKey || apiKey.startsWith('${')) {
          throw new Error('Anthropic API key not configured');
        }
        return new AnthropicProvider(config);
      }

      case 'ollama':
        if (!config.providers.ollama) {
          throw new Error('Ollama not configured');
        }
        return new OllamaProvider(config);

      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  /**
   * Get list of available providers
   */
  getAvailable(): string[] {
    const config = this.getEffectiveConfig();
    const available: string[] = [];
    
    // Check if API key is real (not a placeholder like ${OPENAI_API_KEY})
    const openaiKey = config.providers.openai?.apiKey;
    if (openaiKey && !openaiKey.startsWith('${')) {
      available.push('openai');
    }
    
    const anthropicKey = config.providers.anthropic?.apiKey;
    if (anthropicKey && !anthropicKey.startsWith('${')) {
      available.push('anthropic');
    }
    
    if (config.providers.ollama) {
      available.push('ollama');
    }
    
    return available;
  }

  /**
   * Clear cached providers (call when API keys change)
   */
  clearCache(): void {
    this.providers.clear();
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
    const config = this.getEffectiveConfig();
    const embeddingsConfig = config.providers.embeddings;
    
    if (embeddingsConfig?.provider) {
      return this.get(embeddingsConfig.provider);
    }
    
    // Prefer Ollama for local embeddings, then OpenAI
    if (config.providers.ollama) {
      return this.get('ollama');
    }
    
    const openaiKey = config.providers.openai?.apiKey;
    if (openaiKey && !openaiKey.startsWith('${')) {
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
