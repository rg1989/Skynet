import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, isAbsolute, dirname } from 'path';
import type { Skill, SkillResult } from '../types/index.js';

/**
 * File operation skills
 */

// Helper to resolve path
function resolvePath(path: string, workspaceRoot: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return join(workspaceRoot, path);
}

export const readFileSkill: Skill = {
  name: 'read_file',
  description: 'Read the contents of a file. Returns the file content with line numbers.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (relative to workspace or absolute)',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-based, optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (optional)',
      },
    },
    required: ['path'],
  },
  async execute(params, context): Promise<SkillResult> {
    const { path, offset, limit } = params as { path: string; offset?: number; limit?: number };
    
    try {
      const fullPath = resolvePath(path, context.workspaceRoot);
      
      if (!existsSync(fullPath)) {
        return { success: false, error: `File not found: ${path}` };
      }
      
      const content = readFileSync(fullPath, 'utf-8');
      let lines = content.split('\n');
      
      // Apply offset
      const startLine = offset && offset > 1 ? offset - 1 : 0;
      lines = lines.slice(startLine);
      
      // Apply limit
      if (limit && limit > 0) {
        lines = lines.slice(0, limit);
      }
      
      // Add line numbers
      const lineNumberStart = startLine + 1;
      const numberedLines = lines.map((line: string, i: number) => 
        `${String(lineNumberStart + i).padStart(6)}|${line}`
      );
      
      return {
        success: true,
        data: numberedLines.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const writeFileSkill: Skill = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file if it does not exist, or overwrites if it does.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write (relative to workspace or absolute)',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  async execute(params, context): Promise<SkillResult> {
    const { path, content } = params as { path: string; content: string };
    
    try {
      const fullPath = resolvePath(path, context.workspaceRoot);
      
      // Ensure directory exists
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(fullPath, content, 'utf-8');
      
      return {
        success: true,
        data: { path: fullPath, bytesWritten: content.length },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const editFileSkill: Skill = {
  name: 'edit_file',
  description: 'Edit a file by replacing a specific string with another. Use for precise modifications.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to find and replace',
      },
      new_string: {
        type: 'string',
        description: 'The string to replace it with',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all occurrences. Default is false (replace first only).',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(params, context): Promise<SkillResult> {
    const { path, old_string, new_string, replace_all } = params as {
      path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    };
    
    try {
      const fullPath = resolvePath(path, context.workspaceRoot);
      
      if (!existsSync(fullPath)) {
        return { success: false, error: `File not found: ${path}` };
      }
      
      let content = readFileSync(fullPath, 'utf-8');
      
      if (!content.includes(old_string)) {
        return { success: false, error: 'String not found in file' };
      }
      
      let replacements = 0;
      if (replace_all) {
        const regex = new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        content = content.replace(regex, () => {
          replacements++;
          return new_string;
        });
      } else {
        content = content.replace(old_string, new_string);
        replacements = 1;
      }
      
      writeFileSync(fullPath, content, 'utf-8');
      
      return {
        success: true,
        data: { path: fullPath, replacements },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const listDirectorySkill: Skill = {
  name: 'list_directory',
  description: 'List files and directories in a given path.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list (relative to workspace or absolute)',
      },
    },
    required: ['path'],
  },
  async execute(params, context): Promise<SkillResult> {
    const { path } = params as { path: string };
    
    try {
      const fullPath = resolvePath(path, context.workspaceRoot);
      
      if (!existsSync(fullPath)) {
        return { success: false, error: `Directory not found: ${path}` };
      }
      
      const entries = readdirSync(fullPath);
      const items = entries.map((name: string) => {
        const itemPath = join(fullPath, name);
        try {
          const stat = statSync(itemPath);
          return {
            name,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.isFile() ? stat.size : undefined,
            modified: stat.mtime.toISOString(),
          };
        } catch {
          return { name, type: 'unknown' };
        }
      });
      
      return {
        success: true,
        data: { path: fullPath, items },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const fileSkills = [
  readFileSkill,
  writeFileSkill,
  editFileSkill,
  listDirectorySkill,
];
