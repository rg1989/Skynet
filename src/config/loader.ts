import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { configSchema, type Config } from './schema.js';

/**
 * Load and validate configuration from file and environment
 */

const CONFIG_PATHS = [
  './skynet.config.json',
  './config.json',
  '~/.skynet/config.json',
];

/**
 * Expand ~ to home directory and resolve path
 */
function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return resolve(process.env.HOME || '', path.slice(2));
  }
  return resolve(path);
}

/**
 * Replace ${VAR} patterns with environment variables
 */
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key) => {
      return process.env[key] || '';
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  return obj;
}

/**
 * Find config file from predefined paths
 */
function findConfigFile(): string | null {
  for (const path of CONFIG_PATHS) {
    const expanded = expandPath(path);
    if (existsSync(expanded)) {
      return expanded;
    }
  }
  return null;
}

/**
 * Build config from environment variables (fallback)
 */
function buildConfigFromEnv(): Record<string, unknown> {
  const config: Record<string, unknown> = {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || 'localhost',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    },
    providers: {
      default: process.env.DEFAULT_PROVIDER || 'ollama',
    },
    agent: {},
    dataDir: process.env.DATA_DIR || './data',
  };

  // Add OpenAI if key present
  if (process.env.OPENAI_API_KEY) {
    (config.providers as Record<string, unknown>).openai = {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
  }

  // Add Anthropic if key present
  if (process.env.ANTHROPIC_API_KEY) {
    (config.providers as Record<string, unknown>).anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    };
  }

  // Add Ollama config
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) {
    (config.providers as Record<string, unknown>).ollama = {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2',
    };
  }

  return config;
}

/**
 * Load configuration from file or environment
 */
export function loadConfig(configPath?: string): Config {
  let rawConfig: Record<string, unknown>;

  // Try explicit path first
  if (configPath) {
    const expanded = expandPath(configPath);
    if (!existsSync(expanded)) {
      throw new Error(`Config file not found: ${expanded}`);
    }
    const content = readFileSync(expanded, 'utf-8');
    rawConfig = JSON.parse(content);
  } else {
    // Try predefined paths
    const foundPath = findConfigFile();
    if (foundPath) {
      const content = readFileSync(foundPath, 'utf-8');
      rawConfig = JSON.parse(content);
      console.log(`Loaded config from: ${foundPath}`);
    } else {
      // Fall back to environment variables
      console.log('No config file found, using environment variables');
      rawConfig = buildConfigFromEnv();
    }
  }

  // Substitute environment variables in config
  const substituted = substituteEnvVars(rawConfig) as Record<string, unknown>;

  // Override port from PORT env var (allows dev server on different port)
  if (process.env.PORT) {
    if (!substituted.server) {
      substituted.server = {};
    }
    (substituted.server as Record<string, unknown>).port = parseInt(process.env.PORT, 10);
  }

  // Validate and parse
  const result = configSchema.safeParse(substituted);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Invalid configuration:\n${errors.join('\n')}`);
  }

  return result.data;
}

/**
 * Get default config for development
 */
export function getDefaultConfig(): Partial<Config> {
  return {
    server: { port: 3000, host: 'localhost' },
    providers: {
      default: 'ollama',
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
        toolsEnabled: true,
        toolsMode: 'hybrid' as const,
        chatTimeout: 120000,
        embedTimeout: 30000,
        keepAlive: '10m',
      },
    },
    agent: {
      maxTokens: 4096,
      memory: {
        enabled: true,
        autoRemember: false,
        searchTopK: 5,
      },
    },
    dataDir: './data',
  };
}
