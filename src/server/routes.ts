import { Router, type Request, type Response } from 'express';
import type { Config } from '../config/schema.js';
import type { WSHandler } from './ws-handler.js';
import type { Scheduler } from '../scheduler/cron.js';
import type { AgentRunner } from '../agent/runner.js';

/**
 * REST API routes
 */

// These will be set during initialization
let scheduler: Scheduler | null = null;
let agentRunner: AgentRunner | null = null;

export function setScheduler(s: Scheduler): void {
  scheduler = s;
}

export function setAgentRunner(a: AgentRunner): void {
  agentRunner = a;
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
    const { message, sessionKey } = req.body;
    
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
      });
      
      res.json({
        status: result.status,
        response: result.response,
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
    // Will be implemented with session manager
    res.json({ sessions: [] });
  });

  // Get session history
  router.get('/sessions/:key', async (req: Request, res: Response) => {
    const { key } = req.params;
    // Will be implemented with session manager
    res.json({ 
      key,
      messages: [],
      message: 'Session manager not yet implemented',
    });
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
  router.get('/memory/facts', async (_req: Request, res: Response) => {
    // Will be implemented with memory system
    res.json({ facts: [] });
  });

  router.get('/memory/search', async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }
    // Will be implemented with memory system
    res.json({ 
      query: q,
      results: [],
      message: 'Memory system not yet implemented',
    });
  });

  return router;
}
