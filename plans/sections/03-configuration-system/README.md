# Configuration System Implementation Guide

[← Back to Architecture](../../ARCHITECTURE.md)

---

## Implementation Progress

| Task | Status | Notes |
|------|--------|-------|
| Define TypeScript types | ⬜ | |
| Create Zod schema | ⬜ | |
| Implement config loading | ⬜ | |
| Add JSON5 support | ⬜ | |
| Implement $include directives | ⬜ | |
| Add env variable substitution | ⬜ | |
| Create config validation | ⬜ | |
| Implement config writing | ⬜ | |
| Add migration support | ⬜ | |
| Create hot reload system | ⬜ | |
| Write tests | ⬜ | |

---

## Overview

The Configuration System provides:

- **JSON5 format** with comments and trailing commas
- **Zod validation** for type safety and error messages
- **`$include` directives** for modular configs
- **Environment variable substitution** (`${VAR}`)
- **Migration support** for legacy configs
- **Hot reload** for runtime updates

```mermaid
graph LR
    File[Config File] --> Parse[JSON5 Parse]
    Parse --> Include[Process $include]
    Include --> Env[Substitute ${VAR}]
    Env --> Validate[Zod Validation]
    Validate --> Defaults[Apply Defaults]
    Defaults --> Config[Final Config]
```

---

## File Structure

```
src/config/
├── types.ts              # TypeScript interfaces
├── schema.ts             # Zod schema definitions
├── io.ts                 # Load/save operations
├── validation.ts         # Validation logic
├── defaults.ts           # Default values
├── includes.ts           # $include processing
├── env-substitution.ts   # ${VAR} replacement
├── paths.ts              # Config file paths
├── migrations/
│   ├── index.ts          # Migration runner
│   ├── v1-to-v2.ts       # Version migrations
│   └── legacy.ts         # Legacy key migrations
└── hot-reload.ts         # File watcher for hot reload
```

---

## Core Components

### 1. Configuration Types

**File:** `src/config/types.ts`

```typescript
/**
 * Root configuration interface
 */
export interface Config {
  /** Configuration metadata */
  meta: ConfigMeta;
  
  /** Environment variables to set */
  env?: EnvConfig;
  
  /** Agent configurations */
  agents: AgentsConfig;
  
  /** Messaging channel configurations */
  channels: ChannelsConfig;
  
  /** Plugin configurations */
  plugins?: PluginsConfig;
  
  /** Model provider configurations */
  models?: ModelsConfig;
  
  /** Gateway server configuration */
  gateway: GatewayConfig;
  
  /** Session management configuration */
  session?: SessionConfig;
  
  /** Tool configurations */
  tools?: ToolsConfig;
  
  /** Skills configuration */
  skills?: SkillsConfig;
}

/**
 * Configuration metadata
 */
export interface ConfigMeta {
  /** Last version that touched this config */
  lastTouchedVersion?: string;
  /** Last modification timestamp */
  lastTouchedAt?: number;
  /** Schema version for migrations */
  schemaVersion?: number;
}

/**
 * Environment variable configuration
 */
export interface EnvConfig {
  /** Variables to set in process.env */
  vars?: Record<string, string>;
}

/**
 * Agent configuration
 */
export interface AgentsConfig {
  /** List of configured agents */
  list: AgentConfig[];
  /** Default settings for all agents */
  defaults?: AgentDefaults;
}

export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Whether this is the default agent */
  default?: boolean;
  /** Agent display name */
  name?: string;
  /** Workspace directory */
  workspace?: string;
  /** Primary model (provider/model format) */
  model: string;
  /** Fallback models */
  fallbackModels?: string[];
  /** Memory search configuration */
  memorySearch?: MemorySearchConfig;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
  /** Tool policy */
  tools?: ToolPolicy;
  /** Agent identity for UI */
  identity?: AgentIdentity;
}

export interface AgentDefaults {
  /** Default model for agents */
  model?: string;
  /** Default workspace path */
  workspace?: string;
  /** Default context token limit */
  contextTokens?: number;
  /** Default timeout in seconds */
  timeoutSeconds?: number;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** Server port */
  port: number;
  /** Bind configuration */
  bind?: BindConfig;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** TLS configuration */
  tls?: TlsConfig;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
}

export interface BindConfig {
  /** Bind to loopback only */
  loopback?: boolean;
  /** Bind to LAN interfaces */
  lan?: boolean;
  /** Specific host to bind */
  host?: string;
}

export interface AuthConfig {
  /** Required token for connections */
  token?: string;
  /** Allow insecure local connections */
  allowInsecureLocal?: boolean;
}

/**
 * Channel configuration
 */
export interface ChannelsConfig {
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  slack?: SlackConfig;
  whatsapp?: WhatsAppConfig;
  signal?: SignalConfig;
  imessage?: IMessageConfig;
  // Extensible for plugins
  [key: string]: ChannelConfigBase | undefined;
}

export interface ChannelConfigBase {
  /** Whether channel is enabled */
  enabled?: boolean;
  /** Account configurations */
  accounts?: AccountConfig[];
}

export interface AccountConfig {
  /** Account identifier */
  id: string;
  /** Account-specific settings */
  [key: string]: unknown;
}

/**
 * Plugin configuration
 */
export interface PluginsConfig {
  /** Plugin entries */
  entries?: PluginEntry[];
  /** Plugin load settings */
  load?: PluginLoadConfig;
}

export interface PluginEntry {
  /** Plugin ID */
  id: string;
  /** Whether plugin is enabled */
  enabled?: boolean;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Model provider configuration
 */
export interface ModelsConfig {
  /** Provider configurations */
  providers?: ProviderConfig[];
}

export interface ProviderConfig {
  /** Provider ID */
  id: string;
  /** Provider type (openai, anthropic, etc.) */
  type: string;
  /** API base URL */
  baseUrl?: string;
  /** API key (or env var reference) */
  apiKey?: string;
  /** Available models */
  models?: ModelConfig[];
}

export interface ModelConfig {
  /** Model ID */
  id: string;
  /** Display name */
  name?: string;
  /** Context window size */
  contextWindow?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
}
```

### 2. Zod Schema

**File:** `src/config/schema.ts`

```typescript
import { z } from 'zod';

/**
 * Config meta schema
 */
const configMetaSchema = z.object({
  lastTouchedVersion: z.string().optional(),
  lastTouchedAt: z.number().optional(),
  schemaVersion: z.number().optional(),
});

/**
 * Environment config schema
 */
const envConfigSchema = z.object({
  vars: z.record(z.string()).optional(),
}).optional();

/**
 * Agent config schema
 */
const agentConfigSchema = z.object({
  id: z.string().min(1, 'Agent ID is required'),
  default: z.boolean().optional(),
  name: z.string().optional(),
  workspace: z.string().optional(),
  model: z.string().regex(/^[\w-]+\/[\w.-]+$/, 'Model must be in provider/model format'),
  fallbackModels: z.array(z.string()).optional(),
  memorySearch: z.object({
    enabled: z.boolean().optional(),
    provider: z.string().optional(),
  }).optional(),
  sandbox: z.object({
    enabled: z.boolean().optional(),
    root: z.string().optional(),
  }).optional(),
  tools: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  identity: z.object({
    name: z.string().optional(),
    emoji: z.string().optional(),
    theme: z.string().optional(),
  }).optional(),
});

const agentsConfigSchema = z.object({
  list: z.array(agentConfigSchema).min(1, 'At least one agent is required'),
  defaults: z.object({
    model: z.string().optional(),
    workspace: z.string().optional(),
    contextTokens: z.number().positive().optional(),
    timeoutSeconds: z.number().positive().optional(),
  }).optional(),
});

/**
 * Gateway config schema
 */
const gatewayConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(18789),
  bind: z.object({
    loopback: z.boolean().optional(),
    lan: z.boolean().optional(),
    host: z.string().optional(),
  }).optional(),
  auth: z.object({
    token: z.string().optional(),
    allowInsecureLocal: z.boolean().optional(),
  }).optional(),
  tls: z.object({
    enabled: z.boolean(),
    cert: z.string(),
    key: z.string(),
    ca: z.string().optional(),
  }).optional(),
  heartbeatInterval: z.number().positive().optional(),
});

/**
 * Channel config schemas
 */
const channelBaseSchema = z.object({
  enabled: z.boolean().optional(),
  accounts: z.array(z.object({
    id: z.string(),
  }).passthrough()).optional(),
});

const telegramConfigSchema = channelBaseSchema.extend({
  botToken: z.string().optional(),
});

const discordConfigSchema = channelBaseSchema.extend({
  botToken: z.string().optional(),
  applicationId: z.string().optional(),
});

const channelsConfigSchema = z.object({
  telegram: telegramConfigSchema.optional(),
  discord: discordConfigSchema.optional(),
  slack: channelBaseSchema.optional(),
  whatsapp: channelBaseSchema.optional(),
  signal: channelBaseSchema.optional(),
  imessage: channelBaseSchema.optional(),
}).passthrough(); // Allow plugin channels

/**
 * Plugin config schema
 */
const pluginsConfigSchema = z.object({
  entries: z.array(z.object({
    id: z.string(),
    enabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  })).optional(),
  load: z.object({
    paths: z.array(z.string()).optional(),
    bundled: z.boolean().optional(),
  }).optional(),
}).optional();

/**
 * Models config schema
 */
const modelsConfigSchema = z.object({
  providers: z.array(z.object({
    id: z.string(),
    type: z.string(),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    models: z.array(z.object({
      id: z.string(),
      name: z.string().optional(),
      contextWindow: z.number().positive().optional(),
      maxOutputTokens: z.number().positive().optional(),
    })).optional(),
  })).optional(),
}).optional();

/**
 * Root config schema
 */
export const configSchema = z.object({
  meta: configMetaSchema.default({}),
  env: envConfigSchema,
  agents: agentsConfigSchema,
  channels: channelsConfigSchema.default({}),
  plugins: pluginsConfigSchema,
  models: modelsConfigSchema,
  gateway: gatewayConfigSchema,
  session: z.object({
    directory: z.string().optional(),
    compaction: z.object({
      enabled: z.boolean().optional(),
      threshold: z.number().optional(),
    }).optional(),
  }).optional(),
  tools: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  skills: z.object({
    directories: z.array(z.string()).optional(),
  }).optional(),
});

export type ConfigSchema = z.infer<typeof configSchema>;
```

### 3. Config Loading

**File:** `src/config/io.ts`

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import JSON5 from 'json5';
import { configSchema } from './schema';
import { getConfigPaths } from './paths';
import { processIncludes } from './includes';
import { substituteEnvVars } from './env-substitution';
import { applyDefaults } from './defaults';
import type { Config } from './types';

/**
 * Load configuration from file
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  // Resolve config path
  const paths = getConfigPaths();
  const filePath = configPath || findConfigFile(paths);
  
  if (!filePath) {
    throw new Error(`No config file found. Tried: ${paths.join(', ')}`);
  }
  
  // Read and parse JSON5
  const content = await readFile(filePath, 'utf-8');
  let rawConfig: unknown;
  
  try {
    rawConfig = JSON5.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON5 in ${filePath}: ${err}`);
  }
  
  // Process $include directives
  const configDir = dirname(filePath);
  const expanded = await processIncludes(rawConfig, configDir);
  
  // Substitute environment variables
  const substituted = substituteEnvVars(expanded);
  
  // Apply environment variables from config
  if (substituted.env?.vars) {
    for (const [key, value] of Object.entries(substituted.env.vars)) {
      if (typeof value === 'string') {
        process.env[key] = value;
      }
    }
  }
  
  // Validate with Zod
  const result = configSchema.safeParse(substituted);
  
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${errors}`);
  }
  
  // Apply defaults
  const config = applyDefaults(result.data);
  
  return config as Config;
}

/**
 * Find first existing config file
 */
function findConfigFile(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Save configuration to file
 */
export async function saveConfig(
  config: Config,
  configPath?: string
): Promise<void> {
  const paths = getConfigPaths();
  const filePath = configPath || paths[0];
  
  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });
  
  // Update metadata
  config.meta.lastTouchedAt = Date.now();
  
  // Serialize with JSON5 (preserves readability)
  const content = JSON5.stringify(config, null, 2);
  
  // Create backup before writing
  if (existsSync(filePath)) {
    await rotateBackups(filePath);
  }
  
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Rotate backup files (.bak.1 through .bak.5)
 */
async function rotateBackups(filePath: string): Promise<void> {
  const maxBackups = 5;
  
  // Rotate existing backups
  for (let i = maxBackups - 1; i >= 1; i--) {
    const current = `${filePath}.bak.${i}`;
    const next = `${filePath}.bak.${i + 1}`;
    
    if (existsSync(current)) {
      await rename(current, next);
    }
  }
  
  // Create new backup
  if (existsSync(filePath)) {
    await copyFile(filePath, `${filePath}.bak.1`);
  }
}
```

### 4. Environment Variable Substitution

**File:** `src/config/env-substitution.ts`

```typescript
/**
 * Substitute ${VAR} patterns with environment variable values
 */
export function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return substituteString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * Substitute ${VAR} patterns in a string
 */
function substituteString(str: string): string {
  return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    // Support default values: ${VAR:-default}
    const [name, defaultValue] = varName.split(':-');
    const value = process.env[name.trim()];
    
    if (value !== undefined) {
      return value;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Keep original if no match
    return match;
  });
}

/**
 * Check if a string contains unresolved env vars
 */
export function hasUnresolvedEnvVars(str: string): boolean {
  const pattern = /\$\{([^}]+)\}/g;
  let match;
  
  while ((match = pattern.exec(str)) !== null) {
    const [name] = match[1].split(':-');
    if (process.env[name.trim()] === undefined) {
      return true;
    }
  }
  
  return false;
}
```

### 5. Include Directive Processing

**File:** `src/config/includes.ts`

```typescript
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import JSON5 from 'json5';

/**
 * Process $include directives recursively
 */
export async function processIncludes(
  obj: unknown,
  baseDir: string,
  visited = new Set<string>()
): Promise<unknown> {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return Promise.all(
      obj.map(item => processIncludes(item, baseDir, visited))
    );
  }
  
  const record = obj as Record<string, unknown>;
  
  // Check for $include directive
  if ('$include' in record) {
    const includePath = record.$include;
    
    if (typeof includePath !== 'string') {
      throw new Error('$include must be a string path');
    }
    
    const fullPath = join(baseDir, includePath);
    
    // Prevent circular includes
    if (visited.has(fullPath)) {
      throw new Error(`Circular $include detected: ${fullPath}`);
    }
    visited.add(fullPath);
    
    // Load and parse included file
    const content = await readFile(fullPath, 'utf-8');
    const included = JSON5.parse(content);
    
    // Process includes in the included file
    const processed = await processIncludes(
      included,
      dirname(fullPath),
      visited
    );
    
    // Merge with remaining properties (excluding $include)
    const rest = { ...record };
    delete rest.$include;
    
    return deepMerge(processed, rest);
  }
  
  // Process nested objects
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(record)) {
    result[key] = await processIncludes(value, baseDir, visited);
  }
  
  return result;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== 'object' || target === null) {
    return source;
  }
  
  if (typeof source !== 'object' || source === null) {
    return target;
  }
  
  if (Array.isArray(target) || Array.isArray(source)) {
    return source; // Arrays are replaced, not merged
  }
  
  const result = { ...(target as Record<string, unknown>) };
  
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (key in result) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
```

### 6. Hot Reload

**File:** `src/config/hot-reload.ts`

```typescript
import { watch, type FSWatcher } from 'fs';
import { loadConfig } from './io';
import type { Config } from './types';

export interface HotReloadOptions {
  /** Callback when config changes */
  onChange: (config: Config, changedKeys: string[]) => void;
  /** Callback on reload error */
  onError?: (error: Error) => void;
  /** Debounce interval in ms */
  debounceMs?: number;
}

/**
 * Watch config file for changes and reload
 */
export function watchConfig(
  configPath: string,
  options: HotReloadOptions
): FSWatcher {
  let currentConfig: Config | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  
  const { onChange, onError, debounceMs = 500 } = options;
  
  // Load initial config
  loadConfig(configPath)
    .then(config => {
      currentConfig = config;
    })
    .catch(err => {
      onError?.(err);
    });
  
  // Watch for changes
  const watcher = watch(configPath, (eventType) => {
    if (eventType !== 'change') return;
    
    // Debounce rapid changes
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(async () => {
      try {
        const newConfig = await loadConfig(configPath);
        const changedKeys = findChangedKeys(currentConfig, newConfig);
        
        if (changedKeys.length > 0) {
          currentConfig = newConfig;
          onChange(newConfig, changedKeys);
        }
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, debounceMs);
  });
  
  return watcher;
}

/**
 * Find which top-level keys changed between configs
 */
function findChangedKeys(
  oldConfig: Config | null,
  newConfig: Config
): string[] {
  if (!oldConfig) return Object.keys(newConfig);
  
  const changed: string[] = [];
  const allKeys = new Set([
    ...Object.keys(oldConfig),
    ...Object.keys(newConfig),
  ]);
  
  for (const key of allKeys) {
    const oldValue = JSON.stringify((oldConfig as any)[key]);
    const newValue = JSON.stringify((newConfig as any)[key]);
    
    if (oldValue !== newValue) {
      changed.push(key);
    }
  }
  
  return changed;
}

/**
 * Determine if changes are safe for hot reload
 */
export function isSafeForHotReload(changedKeys: string[]): boolean {
  // These keys are safe to hot reload
  const safeKeys = new Set([
    'agents',
    'tools',
    'skills',
    'session',
    'models',
  ]);
  
  // These require restart
  const unsafeKeys = new Set([
    'gateway',
    'channels',
    'plugins',
  ]);
  
  for (const key of changedKeys) {
    if (unsafeKeys.has(key)) {
      return false;
    }
  }
  
  return true;
}
```

---

## Example Configuration

**File:** `~/.skynet/config.json`

```json5
{
  // Configuration metadata
  meta: {
    schemaVersion: 1,
  },
  
  // Environment variables
  env: {
    vars: {
      OPENAI_API_KEY: "${OPENAI_API_KEY}",
    },
  },
  
  // Agent configurations
  agents: {
    list: [
      {
        id: "default",
        default: true,
        name: "Skynet Agent",
        model: "anthropic/claude-sonnet-4-20250514",
        fallbackModels: ["openai/gpt-4o"],
        workspace: "~/skynet-workspace",
        identity: {
          name: "Skynet",
          emoji: "🤖",
        },
      },
    ],
    defaults: {
      contextTokens: 128000,
      timeoutSeconds: 600,
    },
  },
  
  // Gateway configuration
  gateway: {
    port: 18789,
    bind: {
      loopback: true,
    },
    auth: {
      token: "${GATEWAY_TOKEN}",
    },
  },
  
  // Channel configurations
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
    },
    discord: {
      enabled: false,
    },
  },
  
  // Include additional config
  plugins: {
    $include: "./plugins.json5",
  },
}
```

---

## Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig } from './io';
import { substituteEnvVars } from './env-substitution';

describe('Config Loading', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  
  it('should substitute environment variables', () => {
    process.env.TEST_VAR = 'test-value';
    
    const result = substituteEnvVars({
      key: '${TEST_VAR}',
      nested: {
        value: 'prefix-${TEST_VAR}-suffix',
      },
    });
    
    expect(result).toEqual({
      key: 'test-value',
      nested: {
        value: 'prefix-test-value-suffix',
      },
    });
  });
  
  it('should use default values', () => {
    delete process.env.MISSING_VAR;
    
    const result = substituteEnvVars({
      value: '${MISSING_VAR:-default}',
    });
    
    expect(result).toEqual({
      value: 'default',
    });
  });
  
  it('should validate required fields', async () => {
    vi.mock('fs/promises', () => ({
      readFile: () => Promise.resolve('{ agents: { list: [] } }'),
    }));
    
    await expect(loadConfig('/test/config.json'))
      .rejects.toThrow('At least one agent is required');
  });
});
```

---

## Next Steps

After implementing Configuration System:

1. **[Gateway Server →](../01-gateway-server/README.md)** - Uses config for server settings
2. **[CLI Architecture →](../02-cli-architecture/README.md)** - Config commands

---

## References

- [Zod documentation](https://zod.dev/)
- [JSON5 specification](https://json5.org/)
- [Node.js fs/promises](https://nodejs.org/api/fs.html#promises-api)
