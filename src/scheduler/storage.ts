import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ScheduledTask } from '../types/index.js';

/**
 * Scheduler storage - persists tasks to JSON file
 */

export class SchedulerStorage {
  private filePath: string;
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor(dataDir: string) {
    const scheduledDir = join(dataDir, 'scheduled');
    if (!existsSync(scheduledDir)) {
      mkdirSync(scheduledDir, { recursive: true });
    }
    
    this.filePath = join(scheduledDir, 'tasks.json');
    this.load();
  }

  /**
   * Load tasks from file
   */
  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const tasks: ScheduledTask[] = JSON.parse(content);
      
      for (const task of tasks) {
        this.tasks.set(task.id, task);
      }
    } catch (error) {
      console.warn('Failed to load scheduled tasks:', error);
    }
  }

  /**
   * Save tasks to file
   */
  private save(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      const tasks = Array.from(this.tasks.values());
      writeFileSync(this.filePath, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save scheduled tasks:', error);
    }
  }

  /**
   * Create a new task
   */
  create(task: Omit<ScheduledTask, 'id' | 'createdAt'>): ScheduledTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const newTask: ScheduledTask = {
      ...task,
      id,
      createdAt: Date.now(),
    };
    
    this.tasks.set(id, newTask);
    this.save();
    
    return newTask;
  }

  /**
   * Get a task by ID
   */
  get(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAll(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Update a task
   */
  update(id: string, updates: Partial<ScheduledTask>): ScheduledTask | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    this.save();
    
    return updatedTask;
  }

  /**
   * Delete a task
   */
  delete(id: string): boolean {
    const deleted = this.tasks.delete(id);
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  /**
   * Get enabled tasks
   */
  getEnabled(): ScheduledTask[] {
    return this.getAll().filter(t => t.enabled);
  }
}
