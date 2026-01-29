import type { Skill, SkillResult, ScheduledTask } from '../types/index.js';
import type { Scheduler } from '../scheduler/cron.js';

/**
 * Schedule skills - manage scheduled tasks through the built-in scheduler
 * These skills ensure tasks are visible in the UI and properly managed.
 */

// Scheduler instance (will be set during initialization)
let scheduler: Scheduler | null = null;

/**
 * Initialize schedule skills with a scheduler instance
 */
export function initializeScheduleSkills(schedulerInstance: Scheduler): void {
  scheduler = schedulerInstance;
}

/**
 * Get the scheduler (for direct access)
 */
export function getScheduler(): Scheduler | null {
  return scheduler;
}

export const createScheduledTaskSkill: Skill = {
  name: 'create_scheduled_task',
  description: 'Create a new scheduled task that runs on a cron schedule. Use this instead of system crontab - tasks created here will appear in the UI and can be managed.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'A descriptive name for the task (e.g., "Daily Email Summary", "Morning Wisdom Quote")',
      },
      cron: {
        type: 'string',
        description: 'Cron expression for when to run (e.g., "0 9 * * *" for 9am daily, "*/5 * * * *" for every 5 minutes)',
      },
      prompt: {
        type: 'string',
        description: 'The prompt/instruction to execute when the task runs. This will be sent to the AI agent.',
      },
    },
    required: ['name', 'cron', 'prompt'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!scheduler) {
      return { success: false, error: 'Scheduler not initialized' };
    }

    const { name, cron, prompt } = params as { name: string; cron: string; prompt: string };

    try {
      const task = scheduler.createTask({ name, cron, prompt });
      return {
        success: true,
        data: {
          id: task.id,
          name: task.name,
          cron: task.cron,
          enabled: task.enabled,
          message: `Scheduled task "${name}" created successfully. It will run according to the cron schedule: ${cron}`,
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

export const listScheduledTasksSkill: Skill = {
  name: 'list_scheduled_tasks',
  description: 'List all scheduled tasks, showing their status, schedule, and last run time.',
  parameters: {
    type: 'object',
    properties: {
      enabled_only: {
        type: 'string',
        description: 'If "true", only show enabled tasks',
      },
    },
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!scheduler) {
      return { success: false, error: 'Scheduler not initialized' };
    }

    const { enabled_only } = params as { enabled_only?: string };

    try {
      let tasks = scheduler.getTasks();
      
      if (enabled_only === 'true') {
        tasks = tasks.filter(t => t.enabled);
      }

      return {
        success: true,
        data: {
          count: tasks.length,
          tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            cron: t.cron,
            prompt: t.prompt.slice(0, 100) + (t.prompt.length > 100 ? '...' : ''),
            enabled: t.enabled,
            lastRun: t.lastRun ? new Date(t.lastRun).toISOString() : null,
            lastResult: t.lastResult,
          })),
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

export const updateScheduledTaskSkill: Skill = {
  name: 'update_scheduled_task',
  description: 'Update a scheduled task. Can change the schedule, prompt, or enable/disable it.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The task ID to update',
      },
      name: {
        type: 'string',
        description: 'New name for the task (optional)',
      },
      cron: {
        type: 'string',
        description: 'New cron expression (optional)',
      },
      prompt: {
        type: 'string',
        description: 'New prompt to execute (optional)',
      },
      enabled: {
        type: 'string',
        description: 'Set to "true" to enable or "false" to disable (optional)',
      },
    },
    required: ['id'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!scheduler) {
      return { success: false, error: 'Scheduler not initialized' };
    }

    const { id, name, cron, prompt, enabled } = params as {
      id: string;
      name?: string;
      cron?: string;
      prompt?: string;
      enabled?: string;
    };

    try {
      // Build updates object
      const updates: Partial<ScheduledTask> = {};
      if (name !== undefined) updates.name = name;
      if (cron !== undefined) updates.cron = cron;
      if (prompt !== undefined) updates.prompt = prompt;
      if (enabled !== undefined) updates.enabled = enabled === 'true';

      const task = scheduler.updateTask(id, updates);

      if (!task) {
        return {
          success: false,
          error: `Task with id "${id}" not found`,
        };
      }

      return {
        success: true,
        data: {
          id: task.id,
          name: task.name,
          cron: task.cron,
          enabled: task.enabled,
          message: `Task "${task.name}" updated successfully`,
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

export const deleteScheduledTaskSkill: Skill = {
  name: 'delete_scheduled_task',
  description: 'Delete a scheduled task permanently.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The task ID to delete',
      },
    },
    required: ['id'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!scheduler) {
      return { success: false, error: 'Scheduler not initialized' };
    }

    const { id } = params as { id: string };

    try {
      const deleted = scheduler.deleteTask(id);

      if (!deleted) {
        return {
          success: false,
          error: `Task with id "${id}" not found`,
        };
      }

      return {
        success: true,
        data: {
          id,
          deleted: true,
          message: `Task deleted successfully`,
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

export const triggerScheduledTaskSkill: Skill = {
  name: 'trigger_scheduled_task',
  description: 'Manually trigger a scheduled task to run immediately, regardless of its schedule.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The task ID to trigger',
      },
    },
    required: ['id'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!scheduler) {
      return { success: false, error: 'Scheduler not initialized' };
    }

    const { id } = params as { id: string };

    try {
      const task = scheduler.getTask(id);

      if (!task) {
        return {
          success: false,
          error: `Task with id "${id}" not found`,
        };
      }

      // Trigger the task (this runs async)
      scheduler.triggerTask(id);

      return {
        success: true,
        data: {
          id: task.id,
          name: task.name,
          message: `Task "${task.name}" triggered. It is now running.`,
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

export const scheduleSkills = [
  createScheduledTaskSkill,
  listScheduledTasksSkill,
  updateScheduledTaskSkill,
  deleteScheduledTaskSkill,
  triggerScheduledTaskSkill,
];
