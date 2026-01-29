import type { Skill, SkillResult } from '../types/index.js';
import { getRuntimeConfig, getSelfConfigToolNames } from '../config/runtime.js';
import type { ProviderManager } from '../providers/index.js';

/**
 * Self-configuration skills
 * 
 * These skills allow the AI to introspect and modify its own configuration,
 * enabling self-awareness and adaptive behavior.
 */

// Provider manager instance (set during initialization)
let providerManager: ProviderManager | null = null;

// Known skill names (set during initialization)
let knownSkillNames: string[] = [];

/**
 * Initialize self-config skills with provider manager access
 */
export function initializeSelfConfigSkills(pm: ProviderManager, skillNames: string[]): void {
  providerManager = pm;
  knownSkillNames = skillNames;
}

/**
 * Update the known skill names (call when skills change)
 */
export function updateKnownSkillNames(skillNames: string[]): void {
  knownSkillNames = skillNames;
}

/**
 * Helper: Safely switch to a provider with fallback to Ollama
 */
async function safeProviderSwitch(
  targetProvider: string,
  targetModel?: string
): Promise<{ success: boolean; provider: string; model: string; fallback?: boolean; error?: string }> {
  const rc = getRuntimeConfig();
  const originalProvider = rc.getCurrentProvider();
  const originalModel = rc.getCurrentModel();

  try {
    // Check if target provider is available
    if (providerManager) {
      const available = providerManager.getAvailable();
      if (!available.includes(targetProvider)) {
        throw new Error(`Provider '${targetProvider}' is not available. Available: ${available.join(', ')}`);
      }
    }

    // Try to switch
    rc.setDefaultProvider(targetProvider);
    if (targetModel) {
      rc.setProviderModel(targetProvider, targetModel);
    }

    // Clear provider cache to force recreation with new settings
    if (providerManager) {
      providerManager.clearCache();
    }

    // Verify the new provider is working by checking availability
    if (providerManager) {
      const isAvailable = await providerManager.checkAvailability(targetProvider);
      if (!isAvailable) {
        throw new Error(`Provider '${targetProvider}' is not responding`);
      }
    }

    return {
      success: true,
      provider: targetProvider,
      model: targetModel || rc.getCurrentModel(targetProvider),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // FALLBACK: Try to restore to Ollama (local model) as safety net
    console.error(`[self-config] Provider switch failed: ${errorMsg}`);
    console.log(`[self-config] Attempting fallback to local Ollama model...`);

    try {
      // Check if Ollama is available
      if (providerManager) {
        const available = providerManager.getAvailable();
        if (available.includes('ollama')) {
          rc.setDefaultProvider('ollama');
          providerManager.clearCache();
          
          const ollamaWorks = await providerManager.checkAvailability('ollama');
          if (ollamaWorks) {
            return {
              success: false,
              provider: 'ollama',
              model: rc.getCurrentModel('ollama'),
              fallback: true,
              error: `Failed to switch to ${targetProvider}: ${errorMsg}. FALLBACK: Switched to local Ollama model to keep the agent responsive.`,
            };
          }
        }
      }

      // If Ollama fallback also failed, try to restore original
      rc.setDefaultProvider(originalProvider);
      if (providerManager) {
        providerManager.clearCache();
      }
      
      return {
        success: false,
        provider: originalProvider,
        model: originalModel,
        error: `Failed to switch to ${targetProvider}: ${errorMsg}. Restored original provider.`,
      };
    } catch (fallbackError) {
      // Last resort: just report the error
      return {
        success: false,
        provider: originalProvider,
        model: originalModel,
        error: `Failed to switch to ${targetProvider}: ${errorMsg}. Fallback also failed.`,
      };
    }
  }
}

// ========================================
// Introspection Skills (Read-Only)
// ========================================

export const getConfigSkill: Skill = {
  name: 'get_config',
  description: 'Get your current configuration including provider, model, tools mode, and available providers. Use this to understand your own capabilities.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params, _context): Promise<SkillResult> {
    try {
      const rc = getRuntimeConfig();
      const available = providerManager?.getAvailable() || [];
      
      return {
        success: true,
        data: {
          currentProvider: rc.getCurrentProvider(),
          currentModel: rc.getCurrentModel(),
          toolsMode: rc.getToolsMode(),
          availableProviders: available,
          disabledTools: rc.getDisabledTools(),
          totalTools: knownSkillNames.length,
          enabledTools: knownSkillNames.length - rc.getDisabledTools().length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const listToolsSkill: Skill = {
  name: 'list_tools',
  description: 'List all available tools with their enabled/disabled status. Useful for understanding your capabilities.',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional filter: "enabled", "disabled", or "all" (default: "all")',
        enum: ['enabled', 'disabled', 'all'],
      },
    },
  },
  async execute(params, _context): Promise<SkillResult> {
    try {
      const rc = getRuntimeConfig();
      const filter = (params.filter as string) || 'all';
      const disabledTools = rc.getDisabledTools();
      
      const tools = knownSkillNames.map(name => ({
        name,
        enabled: !disabledTools.includes(name),
      }));

      let filtered = tools;
      if (filter === 'enabled') {
        filtered = tools.filter(t => t.enabled);
      } else if (filter === 'disabled') {
        filtered = tools.filter(t => !t.enabled);
      }

      return {
        success: true,
        data: {
          filter,
          count: filtered.length,
          tools: filtered,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// ========================================
// Tool Control Skills
// ========================================

export const enableToolSkill: Skill = {
  name: 'enable_tool',
  description: 'Enable a specific tool by name. The tool will become available for use.',
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'Name of the tool to enable',
      },
    },
    required: ['tool_name'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const toolName = params.tool_name as string;
    
    try {
      // Validate tool exists
      if (!knownSkillNames.includes(toolName)) {
        return {
          success: false,
          error: `Unknown tool: ${toolName}. Available tools: ${knownSkillNames.slice(0, 10).join(', ')}...`,
        };
      }

      const rc = getRuntimeConfig();
      rc.enableTool(toolName);

      return {
        success: true,
        data: {
          tool: toolName,
          enabled: true,
          message: `Tool '${toolName}' is now enabled`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const disableToolSkill: Skill = {
  name: 'disable_tool',
  description: 'Disable a specific tool by name. The tool will no longer be available for use.',
  parameters: {
    type: 'object',
    properties: {
      tool_name: {
        type: 'string',
        description: 'Name of the tool to disable',
      },
    },
    required: ['tool_name'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const toolName = params.tool_name as string;
    
    try {
      // Prevent disabling self-config tools (safety)
      const selfConfigTools = getSelfConfigToolNames();
      if (selfConfigTools.includes(toolName)) {
        return {
          success: false,
          error: `Cannot disable self-configuration tool '${toolName}'. This would prevent self-management.`,
        };
      }

      // Validate tool exists
      if (!knownSkillNames.includes(toolName)) {
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
      }

      const rc = getRuntimeConfig();
      rc.disableTool(toolName);

      return {
        success: true,
        data: {
          tool: toolName,
          enabled: false,
          message: `Tool '${toolName}' is now disabled`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const setToolsModeSkill: Skill = {
  name: 'set_tools_mode',
  description: 'Change the tools execution mode. Modes: hybrid (try native first, fall back to text), native (API tool calls only), text (text-based tool parsing), disabled (no tools).',
  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        description: 'The tools mode to set',
        enum: ['hybrid', 'native', 'text', 'disabled'],
      },
    },
    required: ['mode'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const mode = params.mode as 'hybrid' | 'native' | 'text' | 'disabled';
    
    try {
      const rc = getRuntimeConfig();
      rc.setToolsMode(mode);

      return {
        success: true,
        data: {
          toolsMode: mode,
          message: `Tools mode set to '${mode}'`,
          warning: mode === 'disabled' ? 'Warning: With tools disabled, I cannot use any skills including this one on the next turn.' : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// ========================================
// Provider/Model Skills
// ========================================

export const switchProviderSkill: Skill = {
  name: 'switch_provider',
  description: 'Switch to a different LLM provider (openai, anthropic, or ollama). If the switch fails, automatically falls back to local Ollama model to keep the agent responsive.',
  parameters: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        description: 'The provider to switch to',
        enum: ['openai', 'anthropic', 'ollama'],
      },
      model: {
        type: 'string',
        description: 'Optional: specific model to use with this provider',
      },
    },
    required: ['provider'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const provider = params.provider as string;
    const model = params.model as string | undefined;
    
    try {
      const result = await safeProviderSwitch(provider, model);

      if (result.success) {
        return {
          success: true,
          data: {
            provider: result.provider,
            model: result.model,
            message: `Successfully switched to ${result.provider}/${result.model}. This change takes effect on the next turn.`,
          },
        };
      } else if (result.fallback) {
        return {
          success: false,
          data: {
            provider: result.provider,
            model: result.model,
            fallback: true,
            originalError: result.error,
          },
          error: result.error,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const switchModelSkill: Skill = {
  name: 'switch_model',
  description: 'Change the model for the current or specified provider. If the switch fails, automatically falls back to local Ollama model.',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'The model name to switch to (e.g., "gpt-4o", "claude-sonnet-4-20250514", "qwen2.5:7b")',
      },
      provider: {
        type: 'string',
        description: 'Optional: switch provider as well',
        enum: ['openai', 'anthropic', 'ollama'],
      },
    },
    required: ['model'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const model = params.model as string;
    const provider = params.provider as string | undefined;
    
    try {
      const rc = getRuntimeConfig();
      const targetProvider = provider || rc.getCurrentProvider();
      
      const result = await safeProviderSwitch(targetProvider, model);

      if (result.success) {
        return {
          success: true,
          data: {
            provider: result.provider,
            model: result.model,
            message: `Successfully switched to ${result.provider}/${result.model}. This change takes effect on the next turn.`,
          },
        };
      } else if (result.fallback) {
        return {
          success: false,
          data: {
            provider: result.provider,
            model: result.model,
            fallback: true,
          },
          error: result.error,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const listModelsSkill: Skill = {
  name: 'list_models',
  description: 'List available models for a provider. For Ollama, queries the local server. For OpenAI/Anthropic, returns common models.',
  parameters: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        description: 'The provider to list models for. Defaults to current provider.',
        enum: ['openai', 'anthropic', 'ollama'],
      },
    },
  },
  async execute(params, context): Promise<SkillResult> {
    const rc = getRuntimeConfig();
    const provider = (params.provider as string) || rc.getCurrentProvider();
    
    try {
      if (provider === 'ollama') {
        // Query Ollama API for models
        const baseUrl = context.config.providers.ollama?.baseUrl || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`);
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}`);
        }
        
        const data = await response.json() as { models: Array<{ name: string; size: number }> };
        
        return {
          success: true,
          data: {
            provider,
            models: data.models.map(m => ({
              name: m.name,
              size: Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
            })),
          },
        };
      } else if (provider === 'openai') {
        return {
          success: true,
          data: {
            provider,
            models: [
              { name: 'gpt-4o', description: 'Most capable GPT-4 model' },
              { name: 'gpt-4o-mini', description: 'Fast and affordable' },
              { name: 'gpt-4-turbo', description: 'GPT-4 Turbo with vision' },
              { name: 'gpt-3.5-turbo', description: 'Fast and efficient' },
            ],
          },
        };
      } else if (provider === 'anthropic') {
        return {
          success: true,
          data: {
            provider,
            models: [
              { name: 'claude-sonnet-4-20250514', description: 'Claude Sonnet 4 - balanced' },
              { name: 'claude-opus-4-20250514', description: 'Claude Opus 4 - most capable' },
              { name: 'claude-3-5-sonnet-20241022', description: 'Claude 3.5 Sonnet' },
              { name: 'claude-3-haiku-20240307', description: 'Fast and efficient' },
            ],
          },
        };
      } else {
        return {
          success: false,
          error: `Unknown provider: ${provider}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// ========================================
// System Prompt Skills
// ========================================

export const getSystemPromptSkill: Skill = {
  name: 'get_system_prompt',
  description: 'View your current system prompt / instructions.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params, _context): Promise<SkillResult> {
    try {
      const rc = getRuntimeConfig();
      const prompt = rc.getSystemPrompt();
      const overrides = rc.getOverrides();
      
      return {
        success: true,
        data: {
          systemPrompt: prompt,
          isCustom: overrides.systemPrompt !== undefined,
          length: prompt.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const setSystemPromptSkill: Skill = {
  name: 'set_system_prompt',
  description: 'Modify your system prompt / instructions. This changes your behavior on the next turn. Use with caution.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The new system prompt',
      },
      append: {
        type: 'string',
        description: 'If true, appends to existing prompt instead of replacing',
      },
    },
    required: ['prompt'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const newPrompt = params.prompt as string;
    const append = params.append === 'true' || params.append === true;
    
    try {
      const rc = getRuntimeConfig();
      
      let finalPrompt: string;
      if (append) {
        const currentPrompt = rc.getSystemPrompt();
        finalPrompt = currentPrompt + '\n\n' + newPrompt;
      } else {
        finalPrompt = newPrompt;
      }
      
      rc.setSystemPrompt(finalPrompt);

      return {
        success: true,
        data: {
          message: append ? 'Appended to system prompt' : 'System prompt updated',
          promptLength: finalPrompt.length,
          takesEffectNextTurn: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// ========================================
// Export all self-config skills
// ========================================

export const selfConfigSkills: Skill[] = [
  // Introspection
  getConfigSkill,
  listToolsSkill,
  // Tool control
  enableToolSkill,
  disableToolSkill,
  setToolsModeSkill,
  // Provider/Model
  switchProviderSkill,
  switchModelSkill,
  listModelsSkill,
  // System prompt
  getSystemPromptSkill,
  setSystemPromptSkill,
];
