import cron from 'node-cron';
import type { ScheduledTask } from '../types/index.js';
import type { AgentRunner } from '../agent/runner.js';
import { SchedulerStorage } from './storage.js';

/**
 * Cron-based task scheduler
 */

interface ScheduledJob {
  task: ScheduledTask;
  cronJob: cron.ScheduledTask;
}

export class Scheduler {
  private storage: SchedulerStorage;
  private agentRunner: AgentRunner;
  private jobs: Map<string, ScheduledJob> = new Map();
  private broadcast: (type: string, payload: unknown) => void;

  constructor(
    dataDir: string,
    agentRunner: AgentRunner,
    broadcast: (type: string, payload: unknown) => void
  ) {
    this.storage = new SchedulerStorage(dataDir);
    this.agentRunner = agentRunner;
    this.broadcast = broadcast;
  }

  /**
   * Start the scheduler and schedule all enabled tasks
   */
  start(): void {
    const tasks = this.storage.getEnabled();
    
    for (const task of tasks) {
      this.scheduleTask(task);
    }
    
    console.log(`Scheduler started with ${tasks.length} active tasks`);
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    for (const job of this.jobs.values()) {
      job.cronJob.stop();
    }
    this.jobs.clear();
    console.log('Scheduler stopped');
  }

  /**
   * Schedule a single task
   */
  private scheduleTask(task: ScheduledTask): void {
    if (!cron.validate(task.cron)) {
      console.error(`Invalid cron expression for task ${task.id}: ${task.cron}`);
      return;
    }

    const cronJob = cron.schedule(task.cron, async () => {
      await this.executeTask(task);
    });

    this.jobs.set(task.id, { task, cronJob });
    
    // Calculate next run time
    const nextRun = this.getNextRunTime(task.cron);
    if (nextRun) {
      this.storage.update(task.id, { nextRun: nextRun.getTime() });
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    console.log(`Executing scheduled task: ${task.name}`);
    
    this.broadcast('task:triggered', { taskId: task.id, name: task.name });
    
    try {
      const result = await this.agentRunner.run({
        message: task.prompt,
        sessionKey: `scheduled:${task.id}`,
      });
      
      // Update last run
      const nextRun = this.getNextRunTime(task.cron);
      this.storage.update(task.id, {
        lastRun: Date.now(),
        nextRun: nextRun?.getTime(),
        lastResult: {
          status: result.status === 'success' ? 'success' : 'error',
          message: result.response || result.error,
        },
      });
      
      console.log(`Task ${task.name} completed: ${result.status}`);
    } catch (error) {
      console.error(`Task ${task.name} failed:`, error);
      
      this.storage.update(task.id, {
        lastRun: Date.now(),
        lastResult: {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(_cronExpr: string): Date | null {
    try {
      // Simple calculation - just add appropriate interval
      // For a proper implementation, use a cron parser library
      return new Date(Date.now() + 60000); // Placeholder
    } catch {
      return null;
    }
  }

  /**
   * Create a new scheduled task
   */
  createTask(params: { name: string; cron: string; prompt: string }): ScheduledTask {
    const task = this.storage.create({
      name: params.name,
      cron: params.cron,
      prompt: params.prompt,
      enabled: true,
    });
    
    this.scheduleTask(task);
    this.broadcast('task:created', { task });
    
    return task;
  }

  /**
   * Update a scheduled task
   */
  updateTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | undefined {
    const task = this.storage.update(id, updates);
    
    if (task) {
      // Reschedule if cron changed or enabled status changed
      const existingJob = this.jobs.get(id);
      if (existingJob) {
        existingJob.cronJob.stop();
        this.jobs.delete(id);
      }
      
      if (task.enabled) {
        this.scheduleTask(task);
      }
      
      this.broadcast('task:updated', { task });
    }
    
    return task;
  }

  /**
   * Delete a scheduled task
   */
  deleteTask(id: string): boolean {
    const existingJob = this.jobs.get(id);
    if (existingJob) {
      existingJob.cronJob.stop();
      this.jobs.delete(id);
    }
    
    const deleted = this.storage.delete(id);
    if (deleted) {
      this.broadcast('task:deleted', { taskId: id });
    }
    
    return deleted;
  }

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return this.storage.getAll();
  }

  /**
   * Get a single task
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.storage.get(id);
  }

  /**
   * Trigger a task immediately
   */
  async triggerTask(id: string): Promise<void> {
    const task = this.storage.get(id);
    if (task) {
      await this.executeTask(task);
    }
  }
}
