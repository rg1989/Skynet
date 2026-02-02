import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Config } from './schema.js';

/**
 * Runtime configuration manager
 * 
 * Manages runtime overrides that can be changed without restarting the server.
 * Optionally persists changes to the config file.
 */

export interface RuntimeOverrides {
  // Provider settings
  defaultProvider?: string;
  providerModels?: Record<string, string>; // provider -> model mapping
  
  // API Keys (stored at runtime only, not persisted to file for security)
  apiKeys?: {
    openai?: string;
    anthropic?: string;
  };
  
  // Tools settings
  toolsMode?: 'hybrid' | 'native' | 'text' | 'disabled';
  disabledTools?: string[]; // List of tool names to disable
  
  // Agent settings
  systemPrompt?: string;
}

export class RuntimeConfig {
  private baseConfig: Config;
  private overrides: RuntimeOverrides = {};
  private configFilePath: string | null = null;

  constructor(baseConfig: Config, configFilePath?: string) {
    this.baseConfig = baseConfig;
    this.configFilePath = configFilePath || this.findConfigFile();
  }

  /**
   * Find the config file path
   */
  private findConfigFile(): string | null {
    const paths = ['./skynet.config.json', './config.json'];
    for (const p of paths) {
      const expanded = resolve(p);
      if (existsSync(expanded)) {
        return expanded;
      }
    }
    return null;
  }

  /**
   * Get the effective configuration (base + overrides)
   */
  getConfig(): Config {
    const config = { ...this.baseConfig };

    // Apply provider override
    if (this.overrides.defaultProvider) {
      config.providers = {
        ...config.providers,
        default: this.overrides.defaultProvider as 'openai' | 'anthropic' | 'ollama',
      };
    }

    // Apply model overrides
    if (this.overrides.providerModels) {
      for (const [provider, model] of Object.entries(this.overrides.providerModels)) {
        const providerKey = provider as keyof typeof config.providers;
        if (config.providers[providerKey] && typeof config.providers[providerKey] === 'object') {
          (config.providers[providerKey] as { model: string }).model = model;
        }
      }
    }

    // Apply API key overrides
    if (this.overrides.apiKeys) {
      if (this.overrides.apiKeys.openai && config.providers.openai) {
        (config.providers.openai as { apiKey: string }).apiKey = this.overrides.apiKeys.openai;
      }
      if (this.overrides.apiKeys.anthropic && config.providers.anthropic) {
        (config.providers.anthropic as { apiKey: string }).apiKey = this.overrides.apiKeys.anthropic;
      }
    }

    // Apply tools mode override
    if (this.overrides.toolsMode) {
      const defaultProvider = config.providers.default;
      const providerConfig = config.providers[defaultProvider];
      if (providerConfig && typeof providerConfig === 'object') {
        (providerConfig as { toolsMode: string }).toolsMode = this.overrides.toolsMode;
      }
    }

    // Apply system prompt override
    if (this.overrides.systemPrompt !== undefined) {
      config.agent = {
        ...config.agent,
        systemPrompt: this.overrides.systemPrompt,
      };
    }

    return config;
  }

  /**
   * Get the base config (without overrides)
   */
  getBaseConfig(): Config {
    return this.baseConfig;
  }

  /**
   * Get current overrides
   */
  getOverrides(): RuntimeOverrides {
    return { ...this.overrides };
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: string): void {
    this.overrides.defaultProvider = provider;
  }

  /**
   * Set the model for a specific provider
   */
  setProviderModel(provider: string, model: string): void {
    if (!this.overrides.providerModels) {
      this.overrides.providerModels = {};
    }
    this.overrides.providerModels[provider] = model;
  }

  /**
   * Set the tools mode
   */
  setToolsMode(mode: 'hybrid' | 'native' | 'text' | 'disabled'): void {
    this.overrides.toolsMode = mode;
  }

  /**
   * Get disabled tools list
   */
  getDisabledTools(): string[] {
    return this.overrides.disabledTools || [];
  }

  /**
   * Set disabled tools
   */
  setDisabledTools(tools: string[]): void {
    this.overrides.disabledTools = tools;
  }

  /**
   * Check if a tool is enabled
   */
  isToolEnabled(toolName: string): boolean {
    const disabled = this.overrides.disabledTools || [];
    return !disabled.includes(toolName);
  }

  /**
   * Enable a tool
   */
  enableTool(toolName: string): void {
    if (!this.overrides.disabledTools) {
      this.overrides.disabledTools = [];
    }
    this.overrides.disabledTools = this.overrides.disabledTools.filter(t => t !== toolName);
  }

  /**
   * Disable a tool
   */
  disableTool(toolName: string): void {
    if (!this.overrides.disabledTools) {
      this.overrides.disabledTools = [];
    }
    if (!this.overrides.disabledTools.includes(toolName)) {
      this.overrides.disabledTools.push(toolName);
    }
  }

  /**
   * Set the system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.overrides.systemPrompt = prompt;
  }

  /**
   * Get the effective system prompt
   */
  getSystemPrompt(): string {
    return this.overrides.systemPrompt ?? this.baseConfig.agent.systemPrompt ?? '';
  }

  /**
   * Reset system prompt to default
   */
  resetSystemPrompt(): void {
    delete this.overrides.systemPrompt;
  }

  /**
   * Set an API key for a provider
   */
  setApiKey(provider: 'openai' | 'anthropic', key: string): void {
    if (!this.overrides.apiKeys) {
      this.overrides.apiKeys = {};
    }
    this.overrides.apiKeys[provider] = key;
  }

  /**
   * Get API key for a provider (returns undefined if not set at runtime)
   */
  getApiKey(provider: 'openai' | 'anthropic'): string | undefined {
    return this.overrides.apiKeys?.[provider];
  }

  /**
   * Check if an API key is configured (either in runtime or base config)
   */
  hasApiKey(provider: 'openai' | 'anthropic'): boolean {
    // Check runtime override first
    if (this.overrides.apiKeys?.[provider]) {
      return true;
    }
    // Check base config
    const providerConfig = this.baseConfig.providers[provider];
    return !!(providerConfig && typeof providerConfig === 'object' && 'apiKey' in providerConfig && providerConfig.apiKey);
  }

  /**
   * Get effective API key (runtime override or base config)
   */
  getEffectiveApiKey(provider: 'openai' | 'anthropic'): string | undefined {
    // Check runtime override first
    if (this.overrides.apiKeys?.[provider]) {
      return this.overrides.apiKeys[provider];
    }
    // Check base config
    const providerConfig = this.baseConfig.providers[provider];
    if (providerConfig && typeof providerConfig === 'object' && 'apiKey' in providerConfig) {
      return providerConfig.apiKey as string;
    }
    return undefined;
  }

  /**
   * Get current provider name
   */
  getCurrentProvider(): string {
    return this.overrides.defaultProvider || this.baseConfig.providers.default;
  }

  /**
   * Get current model for a provider
   */
  getCurrentModel(provider?: string): string {
    const p = provider || this.getCurrentProvider();
    
    // Check overrides first
    if (this.overrides.providerModels?.[p]) {
      return this.overrides.providerModels[p];
    }
    
    // Fall back to base config
    const providerConfig = this.baseConfig.providers[p as keyof typeof this.baseConfig.providers];
    if (providerConfig && typeof providerConfig === 'object' && 'model' in providerConfig) {
      return providerConfig.model as string;
    }
    
    return 'unknown';
  }

  /**
   * Get current tools mode
   */
  getToolsMode(): 'hybrid' | 'native' | 'text' | 'disabled' {
    if (this.overrides.toolsMode) {
      return this.overrides.toolsMode;
    }
    
    const provider = this.getCurrentProvider();
    const providerConfig = this.baseConfig.providers[provider as keyof typeof this.baseConfig.providers];
    if (providerConfig && typeof providerConfig === 'object' && 'toolsMode' in providerConfig) {
      return providerConfig.toolsMode as 'hybrid' | 'native' | 'text' | 'disabled';
    }
    
    return 'hybrid';
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.overrides = {};
  }

  /**
   * Persist current overrides to the config file
   */
  async persistToFile(): Promise<boolean> {
    if (!this.configFilePath) {
      console.warn('No config file path available for persistence');
      return false;
    }

    try {
      // Read current file
      const content = readFileSync(this.configFilePath, 'utf-8');
      const fileConfig = JSON.parse(content);

      // Apply overrides
      if (this.overrides.defaultProvider) {
        fileConfig.providers.default = this.overrides.defaultProvider;
      }

      if (this.overrides.providerModels) {
        for (const [provider, model] of Object.entries(this.overrides.providerModels)) {
          if (fileConfig.providers[provider]) {
            fileConfig.providers[provider].model = model;
          }
        }
      }

      if (this.overrides.toolsMode) {
        const defaultProvider = fileConfig.providers.default;
        if (fileConfig.providers[defaultProvider]) {
          fileConfig.providers[defaultProvider].toolsMode = this.overrides.toolsMode;
        }
      }

      if (this.overrides.systemPrompt !== undefined) {
        if (!fileConfig.agent) fileConfig.agent = {};
        fileConfig.agent.systemPrompt = this.overrides.systemPrompt;
      }

      // Write back
      writeFileSync(this.configFilePath, JSON.stringify(fileConfig, null, 2));
      console.log('Config persisted to:', this.configFilePath);
      return true;
    } catch (error) {
      console.error('Failed to persist config:', error);
      return false;
    }
  }
}

// Self-config tools that should always remain enabled
const SELF_CONFIG_TOOLS = [
  'get_config',
  'list_tools', 
  'enable_tool',
  'disable_tool',
  'set_tools_mode',
  'switch_provider',
  'switch_model',
  'list_models',
  'get_system_prompt',
  'set_system_prompt',
];

// Memory tools needed during onboarding to save user preferences
const ONBOARDING_TOOLS = [
  'remember_fact',
  'recall_fact',
  'list_facts',
];

// Singleton instance
let runtimeConfigInstance: RuntimeConfig | null = null;

/**
 * Initialize the runtime config singleton
 */
export function initializeRuntimeConfig(baseConfig: Config, configFilePath?: string): RuntimeConfig {
  runtimeConfigInstance = new RuntimeConfig(baseConfig, configFilePath);
  return runtimeConfigInstance;
}

/**
 * Initialize default tool states - all tools disabled except self-config
 * This should be called after skills are registered
 * @param allToolNames - List of all available tool names
 * @param onboardingMode - If true, also enables memory tools needed for onboarding
 */
export function initializeDefaultToolStates(allToolNames: string[], onboardingMode: boolean = false): void {
  if (!runtimeConfigInstance) {
    throw new Error('RuntimeConfig not initialized. Call initializeRuntimeConfig first.');
  }
  
  // Determine which tools to keep enabled
  const enabledTools = [...SELF_CONFIG_TOOLS];
  if (onboardingMode) {
    enabledTools.push(...ONBOARDING_TOOLS);
  }
  
  // Disable all tools except the enabled ones
  const toolsToDisable = allToolNames.filter(name => !enabledTools.includes(name));
  runtimeConfigInstance.setDisabledTools(toolsToDisable);
  
  const modeLabel = onboardingMode ? 'self-config + onboarding' : 'self-config';
  console.log(`[runtime] Default tool states: ${enabledTools.length} enabled (${modeLabel}), ${toolsToDisable.length} disabled`);
}

/**
 * Get the list of self-config tool names
 */
export function getSelfConfigToolNames(): string[] {
  return [...SELF_CONFIG_TOOLS];
}

/**
 * Get the runtime config singleton
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfigInstance) {
    throw new Error('RuntimeConfig not initialized. Call initializeRuntimeConfig first.');
  }
  return runtimeConfigInstance;
}
