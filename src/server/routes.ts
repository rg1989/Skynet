import { Router, type Request, type Response } from 'express';
import { readdir, readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import type { Config } from '../config/schema.js';
import type { WSHandler } from './ws-handler.js';
import type { Scheduler } from '../scheduler/cron.js';
import type { AgentRunner } from '../agent/runner.js';
import type { ProviderManager } from '../providers/index.js';
import { getRuntimeConfig } from '../config/runtime.js';
import { getMemoryStore } from '../skills/memory.js';

// Session utilities
const SESSIONS_DIR = join(process.cwd(), 'data', 'sessions');

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface SessionInfo {
  key: string;
  messageCount: number;
  lastActivity: number;
  createdAt: number;
}

async function listSessions(): Promise<SessionInfo[]> {
  try {
    const files = await readdir(SESSIONS_DIR);
    const sessions: SessionInfo[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      
      const key = file.replace('.jsonl', '');
      const filePath = join(SESSIONS_DIR, file);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        const messages = lines.map(l => JSON.parse(l) as SessionMessage);
        
        const fileStat = await stat(filePath);
        const timestamps = messages.map(m => m.timestamp).filter(t => t);
        
        sessions.push({
          key,
          messageCount: messages.length,
          lastActivity: timestamps.length > 0 ? Math.max(...timestamps) : fileStat.mtimeMs,
          createdAt: timestamps.length > 0 ? Math.min(...timestamps) : fileStat.birthtimeMs,
        });
      } catch {
        // Skip malformed files
      }
    }
    
    // Sort by last activity, most recent first
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

async function readSession(key: string): Promise<SessionMessage[]> {
  const filePath = join(SESSIONS_DIR, `${key}.jsonl`);
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    return lines.map(l => JSON.parse(l) as SessionMessage);
  } catch {
    return [];
  }
}

async function deleteSession(key: string): Promise<boolean> {
  const filePath = join(SESSIONS_DIR, `${key}.jsonl`);
  
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * REST API routes
 */

// These will be set during initialization
let scheduler: Scheduler | null = null;
let agentRunner: AgentRunner | null = null;
let providerManager: ProviderManager | null = null;

export function setScheduler(s: Scheduler): void {
  scheduler = s;
}

export function setAgentRunner(a: AgentRunner): void {
  agentRunner = a;
}

export function setProviderManager(p: ProviderManager): void {
  providerManager = p;
}

export function createRoutes(config: Config, wsHandler: WSHandler): Router {
  const router = Router();

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      clients: wsHandler.clientCount,
    });
  });

  // Get current configuration (sanitized)
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      server: config.server,
      providers: {
        default: config.providers.default,
        available: [
          config.providers.openai ? 'openai' : null,
          config.providers.anthropic ? 'anthropic' : null,
          config.providers.ollama ? 'ollama' : null,
        ].filter(Boolean),
      },
      agent: {
        maxTokens: config.agent.maxTokens,
        memory: config.agent.memory,
      },
    });
  });

  // Send a message to the agent (for web UI)
  router.post('/chat', async (req: Request, res: Response) => {
    const { message, sessionKey, persona } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!agentRunner) {
      res.status(503).json({ error: 'Agent not initialized' });
      return;
    }

    try {
      const result = await agentRunner.run({
        message,
        sessionKey: sessionKey || 'web-default',
        persona: persona || undefined,
      });
      
      res.json({
        status: result.status,
        response: result.response,
        runId: result.runId,  // Include runId for frontend coordination with WebSocket events
        error: result.error,
        toolsUsed: result.toolsUsed,
        durationMs: result.durationMs,
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process message' 
      });
    }
  });

  // List sessions
  router.get('/sessions', async (_req: Request, res: Response) => {
    try {
      const sessions = await listSessions();
      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list sessions' });
    }
  });

  // Get session history
  router.get('/sessions/:key', async (req: Request, res: Response) => {
    const key = req.params.key as string;
    
    try {
      const messages = await readSession(key);
      res.json({ key, messages });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to read session' });
    }
  });

  // Delete session
  router.delete('/sessions/:key', async (req: Request, res: Response) => {
    const key = req.params.key as string;
    
    try {
      const deleted = await deleteSession(key);
      if (deleted) {
        res.json({ status: 'deleted', key });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete session' });
    }
  });

  // List scheduled tasks
  router.get('/tasks', async (_req: Request, res: Response) => {
    if (!scheduler) {
      res.json({ tasks: [] });
      return;
    }
    res.json({ tasks: scheduler.getTasks() });
  });

  // Create scheduled task
  router.post('/tasks', async (req: Request, res: Response) => {
    const { name, cron, prompt } = req.body;
    
    if (!name || !cron || !prompt) {
      res.status(400).json({ error: 'name, cron, and prompt are required' });
      return;
    }

    if (!scheduler) {
      res.status(503).json({ error: 'Scheduler not initialized' });
      return;
    }

    try {
      const task = scheduler.createTask({ name, cron, prompt });
      res.json({ status: 'created', task });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create task' });
    }
  });

  // Update scheduled task
  router.put('/tasks/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    
    if (!scheduler) {
      res.status(503).json({ error: 'Scheduler not initialized' });
      return;
    }

    const task = scheduler.updateTask(id, req.body);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.json({ task });
  });

  // Delete scheduled task
  router.delete('/tasks/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    
    if (!scheduler) {
      res.status(503).json({ error: 'Scheduler not initialized' });
      return;
    }

    const deleted = scheduler.deleteTask(id);
    res.json({ deleted });
  });

  // Trigger a task immediately
  router.post('/tasks/:id/trigger', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    
    if (!scheduler) {
      res.status(503).json({ error: 'Scheduler not initialized' });
      return;
    }

    try {
      await scheduler.triggerTask(id);
      res.json({ status: 'triggered' });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to trigger task' });
    }
  });

  // Memory endpoints
  router.get('/memory/facts', async (req: Request, res: Response) => {
    try {
      const memoryStore = getMemoryStore();
      if (!memoryStore) {
        res.status(503).json({ error: 'Memory system not initialized' });
        return;
      }
      
      const prefix = req.query.prefix as string | undefined;
      const facts = memoryStore.listFacts(prefix);
      res.json({ facts });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get facts' });
    }
  });

  router.get('/memory/search', async (req: Request, res: Response) => {
    const { q, limit } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    
    try {
      const memoryStore = getMemoryStore();
      if (!memoryStore) {
        res.status(503).json({ error: 'Memory system not initialized' });
        return;
      }
      
      const searchLimit = limit ? parseInt(limit as string, 10) : 5;
      const results = await memoryStore.search(q as string, searchLimit);
      
      res.json({ 
        query: q,
        results,
        count: results.length,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search memories' });
    }
  });

  // Get memory statistics
  router.get('/memory/stats', async (_req: Request, res: Response) => {
    try {
      const memoryStore = getMemoryStore();
      if (!memoryStore) {
        res.status(503).json({ error: 'Memory system not initialized' });
        return;
      }
      
      const stats = memoryStore.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get memory stats' });
    }
  });

  // ========================================
  // Provider and Model Management
  // ========================================

  // List all providers with their current models and availability
  router.get('/providers', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      const available = providerManager?.getAvailable() || [];
      const currentProvider = runtimeConfig.getCurrentProvider();
      
      const providers = await Promise.all(
        available.map(async (name) => {
          const isAvailable = await providerManager?.checkAvailability(name) ?? false;
          const model = runtimeConfig.getCurrentModel(name);
          return {
            name,
            model,
            isDefault: name === currentProvider,
            isAvailable,
          };
        })
      );
      
      res.json({ providers, currentProvider });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get providers' });
    }
  });

  // List available models for a provider
  router.get('/providers/:name/models', async (req: Request, res: Response) => {
    const { name } = req.params;
    
    try {
      if (name === 'ollama') {
        // Fetch models from Ollama API
        const ollamaConfig = config.providers.ollama;
        const baseUrl = ollamaConfig?.baseUrl || 'http://localhost:11434';
        
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status}`);
        }
        
        const data = await response.json() as { models: Array<{ name: string; size: number; modified_at: string }> };
        const models = data.models.map(m => ({
          name: m.name,
          size: m.size,
          modified: m.modified_at,
        }));
        
        res.json({ provider: name, models });
      } else if (name === 'openai') {
        // OpenAI common models
        res.json({
          provider: name,
          models: [
            { name: 'gpt-4o', description: 'Most capable GPT-4 model' },
            { name: 'gpt-4o-mini', description: 'Fast and affordable' },
            { name: 'gpt-4-turbo', description: 'GPT-4 Turbo with vision' },
            { name: 'gpt-3.5-turbo', description: 'Fast and efficient' },
          ],
        });
      } else if (name === 'anthropic') {
        // Anthropic models
        res.json({
          provider: name,
          models: [
            { name: 'claude-sonnet-4-20250514', description: 'Claude Sonnet 4' },
            { name: 'claude-opus-4-20250514', description: 'Claude Opus 4' },
            { name: 'claude-3-5-sonnet-20241022', description: 'Claude 3.5 Sonnet' },
            { name: 'claude-3-haiku-20240307', description: 'Fast and efficient' },
          ],
        });
      } else {
        res.status(404).json({ error: `Unknown provider: ${name}` });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get models' });
    }
  });

  // ========================================
  // API Keys Management
  // ========================================

  // Get API key status (not the actual keys for security)
  router.get('/config/api-keys', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      
      res.json({
        openai: {
          configured: runtimeConfig.hasApiKey('openai'),
        },
        anthropic: {
          configured: runtimeConfig.hasApiKey('anthropic'),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get API keys status' });
    }
  });

  // Update API keys
  router.put('/config/api-keys', async (req: Request, res: Response) => {
    const { openai, anthropic } = req.body;
    
    try {
      const runtimeConfig = getRuntimeConfig();
      
      if (openai && typeof openai === 'string') {
        runtimeConfig.setApiKey('openai', openai);
      }
      
      if (anthropic && typeof anthropic === 'string') {
        runtimeConfig.setApiKey('anthropic', anthropic);
      }
      
      // Clear cached providers so they're recreated with new API keys
      if (providerManager) {
        providerManager.clearCache();
      }
      
      res.json({
        status: 'updated',
        openai: { configured: runtimeConfig.hasApiKey('openai') },
        anthropic: { configured: runtimeConfig.hasApiKey('anthropic') },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update API keys' });
    }
  });

  // Test provider connection by making a minimal API call
  router.post('/config/test-connection/:provider', async (req: Request, res: Response) => {
    const provider = req.params.provider as string;
    
    try {
      if (!providerManager) {
        res.status(500).json({ success: false, error: 'Provider manager not initialized' });
        return;
      }

      // Check if provider is available
      const available = providerManager.getAvailable();
      if (!available.includes(provider)) {
        res.status(400).json({ 
          success: false, 
          error: `Provider ${provider} is not available. Check API key.` 
        });
        return;
      }

      // Get the provider instance and make a minimal test call
      const providerInstance = providerManager.get(provider);
      
      const startTime = Date.now();
      
      // Make a minimal test request
      let testPassed = false;
      let errorMessage = '';
      
      try {
        // Try streaming a very short response to test the connection
        for await (const chunk of providerInstance.chatStream({
          messages: [{ role: 'user', content: 'Say "ok"' }],
          maxTokens: 5,
        })) {
          if (chunk.delta || chunk.finishReason) {
            testPassed = true;
            break;
          }
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
      
      const durationMs = Date.now() - startTime;
      
      if (testPassed) {
        res.json({ 
          success: true, 
          provider, 
          durationMs,
          message: `Connected to ${provider} successfully` 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          provider,
          error: errorMessage || `Failed to connect to ${provider}` 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      });
    }
  });

  // Update default provider and/or model
  router.put('/config/provider', async (req: Request, res: Response) => {
    const { provider, model } = req.body;
    
    try {
      const runtimeConfig = getRuntimeConfig();
      
      if (provider) {
        const available = providerManager?.getAvailable() || [];
        if (!available.includes(provider)) {
          res.status(400).json({ error: `Provider not available: ${provider}` });
          return;
        }
        runtimeConfig.setDefaultProvider(provider);
      }
      
      if (model) {
        const targetProvider = provider || runtimeConfig.getCurrentProvider();
        runtimeConfig.setProviderModel(targetProvider, model);
      }
      
      res.json({
        status: 'updated',
        provider: runtimeConfig.getCurrentProvider(),
        model: runtimeConfig.getCurrentModel(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update provider' });
    }
  });

  // ========================================
  // Tools Management
  // ========================================

  // List all available tools
  router.get('/tools', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      const skills = agentRunner?.getSkills() || [];
      const disabledTools = runtimeConfig.getDisabledTools();
      const toolsMode = runtimeConfig.getToolsMode();
      
      const tools = skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        enabled: !disabledTools.includes(skill.name),
        parameters: skill.parameters,
      }));
      
      res.json({ tools, toolsMode, disabledCount: disabledTools.length });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get tools' });
    }
  });

  // Enable/disable a tool
  router.put('/tools/:name', async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { enabled } = req.body;
    
    try {
      const runtimeConfig = getRuntimeConfig();
      const skills = agentRunner?.getSkills() || [];
      
      // Check if tool exists
      const tool = skills.find(s => s.name === name);
      if (!tool) {
        res.status(404).json({ error: `Tool not found: ${name}` });
        return;
      }
      
      if (enabled) {
        runtimeConfig.enableTool(name);
      } else {
        runtimeConfig.disableTool(name);
      }
      
      res.json({ 
        name, 
        enabled: runtimeConfig.isToolEnabled(name),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update tool' });
    }
  });

  // Meta-tools that should always stay enabled for Ollama (self-management capabilities)
  const OLLAMA_META_TOOLS = ['list_tools', 'enable_tool', 'disable_tool'];

  // Disable all tools except meta-tools (for Ollama performance optimization)
  router.post('/tools/disable-all-except-meta', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      const skills = agentRunner?.getSkills() || [];
      
      let disabledCount = 0;
      for (const skill of skills) {
        if (!OLLAMA_META_TOOLS.includes(skill.name)) {
          runtimeConfig.disableTool(skill.name);
          disabledCount++;
        }
      }
      
      // Ensure meta-tools are enabled
      for (const name of OLLAMA_META_TOOLS) {
        runtimeConfig.enableTool(name);
      }
      
      res.json({ 
        status: 'ok', 
        disabledCount,
        metaToolsEnabled: OLLAMA_META_TOOLS,
        message: `Disabled ${disabledCount} tools. Meta-tools remain enabled for self-management.`,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to disable tools' });
    }
  });

  // Enable multiple tools at once (bulk enable)
  router.post('/tools/enable-bulk', async (req: Request, res: Response) => {
    const { tools } = req.body;
    
    if (!Array.isArray(tools)) {
      res.status(400).json({ error: 'tools must be an array of tool names' });
      return;
    }
    
    try {
      const runtimeConfig = getRuntimeConfig();
      const skills = agentRunner?.getSkills() || [];
      const validToolNames = skills.map(s => s.name);
      
      let enabledCount = 0;
      const enabled: string[] = [];
      const notFound: string[] = [];
      
      for (const name of tools) {
        if (validToolNames.includes(name)) {
          runtimeConfig.enableTool(name);
          enabled.push(name);
          enabledCount++;
        } else {
          notFound.push(name);
        }
      }
      
      res.json({ 
        status: 'ok', 
        enabledCount,
        enabled,
        notFound: notFound.length > 0 ? notFound : undefined,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to enable tools' });
    }
  });

  // Update tools mode
  router.put('/config/tools-mode', async (req: Request, res: Response) => {
    const { mode } = req.body;
    
    if (!['hybrid', 'native', 'text', 'disabled'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode. Must be: hybrid, native, text, or disabled' });
      return;
    }
    
    try {
      const runtimeConfig = getRuntimeConfig();
      runtimeConfig.setToolsMode(mode);
      
      res.json({ status: 'updated', toolsMode: mode });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update tools mode' });
    }
  });

  // ========================================
  // System Prompt Management
  // ========================================

  // Get current system prompt
  router.get('/system-prompt', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      const prompt = runtimeConfig.getSystemPrompt();
      const isDefault = runtimeConfig.getOverrides().systemPrompt === undefined;
      
      res.json({ prompt, isDefault });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get system prompt' });
    }
  });

  // Update system prompt
  router.put('/system-prompt', async (req: Request, res: Response) => {
    const { prompt } = req.body;
    
    if (typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt must be a string' });
      return;
    }
    
    try {
      const runtimeConfig = getRuntimeConfig();
      runtimeConfig.setSystemPrompt(prompt);
      
      res.json({ status: 'updated', prompt });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update system prompt' });
    }
  });

  // Reset system prompt to default
  router.delete('/system-prompt', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      runtimeConfig.resetSystemPrompt();
      
      res.json({ 
        status: 'reset', 
        prompt: runtimeConfig.getSystemPrompt(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reset system prompt' });
    }
  });

  // ========================================
  // Model Warmup
  // ========================================

  // Warmup the current model
  router.post('/warmup', async (_req: Request, res: Response) => {
    try {
      const runtimeConfig = getRuntimeConfig();
      const currentProvider = runtimeConfig.getCurrentProvider();
      const currentModel = runtimeConfig.getCurrentModel();
      
      const provider = providerManager?.get(currentProvider);
      if (!provider) {
        res.status(503).json({ error: 'Provider not available' });
        return;
      }

      // Check if provider has warmup method
      if ('warmup' in provider && typeof provider.warmup === 'function') {
        const startTime = Date.now();
        await provider.warmup();
        const duration = Date.now() - startTime;
        
        res.json({ 
          status: 'warmed up', 
          provider: currentProvider,
          model: currentModel,
          durationMs: duration,
        });
      } else {
        // Fallback: send a minimal chat request
        const startTime = Date.now();
        const messages = [{ role: 'user' as const, content: 'hi' }];
        
        for await (const _chunk of provider.chatStream({ messages, maxTokens: 1 })) {
          // Just consume the stream
          break;
        }
        
        const duration = Date.now() - startTime;
        res.json({ 
          status: 'warmed up (fallback)', 
          provider: currentProvider,
          model: currentModel,
          durationMs: duration,
        });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to warmup' });
    }
  });

  return router;
}
