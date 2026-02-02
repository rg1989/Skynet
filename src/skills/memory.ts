import type { Skill, SkillResult } from '../types/index.js';
import { MemoryStore } from '../memory/store.js';

/**
 * Memory skills - facts and semantic memory
 */

// Memory store instance (will be set during initialization)
let memoryStore: MemoryStore | null = null;

/**
 * Initialize memory skills with a store instance
 */
export function initializeMemorySkills(store: MemoryStore): void {
  memoryStore = store;
}

/**
 * Get the memory store (for direct access)
 */
export function getMemoryStore(): MemoryStore | null {
  return memoryStore;
}

export const rememberFactSkill: Skill = {
  name: 'remember_fact',
  description: 'Store a key-value fact for later recall. Good for storing specific information like preferences, names, dates, etc.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'A descriptive key for the fact (e.g., "user_favorite_color", "project_deadline")',
      },
      value: {
        type: 'string',
        description: 'The value to store',
      },
    },
    required: ['key', 'value'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { key, value } = params as { key: string; value: string };
    
    try {
      memoryStore.setFact(key, value);
      return {
        success: true,
        data: { key, value, message: `Stored fact: ${key}` },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const recallFactSkill: Skill = {
  name: 'recall_fact',
  description: 'Retrieve a previously stored fact by its key.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key of the fact to recall',
      },
    },
    required: ['key'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { key } = params as { key: string };
    
    try {
      const fact = memoryStore.getFact(key);
      
      if (!fact) {
        return {
          success: true,
          data: { found: false, message: `No fact found with key: ${key}` },
        };
      }
      
      return {
        success: true,
        data: { found: true, key: fact.key, value: fact.value },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const listFactsSkill: Skill = {
  name: 'list_facts',
  description: 'List all stored facts, optionally filtered by a key prefix.',
  parameters: {
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        description: 'Optional prefix to filter facts (e.g., "user_" to list all user-related facts)',
      },
    },
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { prefix } = params as { prefix?: string };
    
    try {
      const facts = memoryStore.listFacts(prefix);
      return {
        success: true,
        data: {
          count: facts.length,
          facts: facts.map((f: { key: string; value: string }) => ({ key: f.key, value: f.value })),
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

export const rememberSkill: Skill = {
  name: 'remember',
  description: 'Store a piece of information in semantic memory. Good for longer content that you want to search later by meaning.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember',
      },
      tags: {
        type: 'string',
        description: 'Optional comma-separated tags for categorization',
      },
    },
    required: ['content'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { content, tags } = params as { content: string; tags?: string };
    
    try {
      const metadata = tags ? { tags: tags.split(',').map((t: string) => t.trim()) } : undefined;
      const id = await memoryStore.remember(content, metadata);
      
      return {
        success: true,
        data: { id, content: content.slice(0, 100) + (content.length > 100 ? '...' : ''), message: 'Memory stored' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const searchMemorySkill: Skill = {
  name: 'search_memory',
  description: 'Search your memories by meaning. Returns the most relevant memories matching your query.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to search for in your memories',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default 5)',
      },
    },
    required: ['query'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { query, limit } = params as { query: string; limit?: number };
    
    try {
      const results = await memoryStore.search(query, limit || 5);
      
      return {
        success: true,
        data: {
          query,
          count: results.length,
          results: results.map((r: { memory: { content: string; id: string }; score: number }) => ({
            content: r.memory.content,
            score: Math.round(r.score * 100) / 100,
            id: r.memory.id,
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

export const forgetSkill: Skill = {
  name: 'forget',
  description: 'Delete a specific memory or fact.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of item to forget: "fact" or "memory"',
        enum: ['fact', 'memory'],
      },
      id: {
        type: 'string',
        description: 'The key (for facts) or ID (for memories) to delete',
      },
    },
    required: ['type', 'id'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!memoryStore) {
      return { success: false, error: 'Memory system not initialized' };
    }

    const { type, id } = params as { type: 'fact' | 'memory'; id: string };
    
    try {
      let deleted: boolean;
      
      if (type === 'fact') {
        deleted = memoryStore.deleteFact(id);
      } else {
        deleted = memoryStore.forget(id);
      }
      
      return {
        success: true,
        data: { deleted, type, id },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const memorySkills = [
  rememberFactSkill,
  recallFactSkill,
  listFactsSkill,
  rememberSkill,
  searchMemorySkill,
  forgetSkill,
];
