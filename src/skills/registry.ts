import type { Skill } from '../types/index.js';
import { fileSkills } from './file-ops.js';
import { execSkills } from './exec.js';
import { webSkills } from './web-browse.js';
import { memorySkills } from './memory.js';
import { visionSkills } from './vision.js';
import { audioSkills } from './audio.js';
import { gmailSkills } from './gmail.js';
import { selfConfigSkills } from './self-config.js';
import { layoutSkills } from './layout.js';
import { scheduleSkills } from './schedule.js';
import { prefectSkills } from './prefect.js';

/**
 * Skill Registry - manages all available skills
 */

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill ${skill.name} already registered, overwriting`);
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: Skill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get skill names
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get skill count
   */
  get count(): number {
    return this.skills.size;
  }
}

/**
 * Create a registry with all core skills
 */
export function createCoreSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  
  // Register all skills
  registry.registerAll(fileSkills);
  registry.registerAll(execSkills);
  registry.registerAll(webSkills);
  registry.registerAll(memorySkills);
  registry.registerAll(visionSkills);
  registry.registerAll(audioSkills);
  registry.registerAll(gmailSkills);
  registry.registerAll(selfConfigSkills);
  registry.registerAll(layoutSkills);
  registry.registerAll(scheduleSkills);
  registry.registerAll(prefectSkills);
  
  return registry;
}

// Re-export skills for direct access
export { fileSkills } from './file-ops.js';
export { execSkills } from './exec.js';
export { webSkills } from './web-browse.js';
export { memorySkills } from './memory.js';
export { visionSkills } from './vision.js';
export { audioSkills } from './audio.js';
export { gmailSkills } from './gmail.js';
export { selfConfigSkills } from './self-config.js';
export { layoutSkills } from './layout.js';
export { scheduleSkills } from './schedule.js';
export { prefectSkills } from './prefect.js';
