import { z } from 'zod';

/**
 * Configuration schema using Zod for validation
 */

const serverSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
});

const telegramSchema = z.object({
  botToken: z.string(),
  allowedUsers: z.array(z.number()).optional(),
});

// Tools mode for each provider
// - hybrid: Try native API first, fall back to text parsing (best compatibility)
// - native: Only use native API tool calls (for models with confirmed support)
// - text: Only use text-based <tool_call> approach (works with any model)
// - disabled: No tools, simple chat mode
const toolsModeSchema = z.enum(['hybrid', 'native', 'text', 'disabled']).default('hybrid');

const openaiProviderSchema = z.object({
  apiKey: z.string(),
  model: z.string().default('gpt-4o'),
  visionModel: z.string().default('gpt-4o'),
  toolsEnabled: z.boolean().default(true),
  toolsMode: toolsModeSchema,
});

const anthropicProviderSchema = z.object({
  apiKey: z.string(),
  model: z.string().default('claude-sonnet-4-20250514'),
  toolsEnabled: z.boolean().default(true),
  toolsMode: toolsModeSchema,
});

const ollamaProviderSchema = z.object({
  baseUrl: z.string().default('http://localhost:11434'),
  model: z.string(),
  visionModel: z.string().optional(),
  toolsEnabled: z.boolean().default(true),
  toolsMode: toolsModeSchema,
  // Timeout configuration in milliseconds
  chatTimeout: z.number().default(120000), // 2 minutes for chat (model loading + generation)
  embedTimeout: z.number().default(30000), // 30 seconds for embeddings
  // Keep-alive duration (how long Ollama keeps model loaded after request)
  keepAlive: z.string().default('10m'), // Keep model loaded for 10 minutes
});

const embeddingsSchema = z.object({
  provider: z.enum(['openai', 'ollama']).default('openai'),
  model: z.string().optional(),
});

const providersSchema = z.object({
  default: z.enum(['openai', 'anthropic', 'ollama']),
  openai: openaiProviderSchema.optional(),
  anthropic: anthropicProviderSchema.optional(),
  ollama: ollamaProviderSchema.optional(),
  embeddings: embeddingsSchema.optional(),
});

const memoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoRemember: z.boolean().default(false),
  searchTopK: z.number().default(5),
});

const agentSchema = z.object({
  systemPrompt: z.string().optional(),
  maxTokens: z.number().default(4096),
  memory: memoryConfigSchema.optional(),
});

const hardwareSchema = z.object({
  screenshot: z.string().optional(),
  webcam: z.string().optional(),
  tts: z.string().optional(),
  microphone: z.string().optional(),
  speaker: z.string().optional(),
});

const gmailSchema = z.object({
  credentialsPath: z.string(),
  tokenPath: z.string().optional(),
});

export const configSchema = z.object({
  server: serverSchema.default({ port: 3000, host: 'localhost' }),
  telegram: telegramSchema,
  providers: providersSchema,
  agent: agentSchema.default({ maxTokens: 4096 }),
  hardware: hardwareSchema.optional(),
  gmail: gmailSchema.optional(),
  dataDir: z.string().default('./data'),
});

export type Config = z.infer<typeof configSchema>;
export type ServerConfig = z.infer<typeof serverSchema>;
export type TelegramConfig = z.infer<typeof telegramSchema>;
export type ProvidersConfig = z.infer<typeof providersSchema>;
export type AgentConfig = z.infer<typeof agentSchema>;
export type HardwareConfig = z.infer<typeof hardwareSchema>;
export type GmailConfig = z.infer<typeof gmailSchema>;
