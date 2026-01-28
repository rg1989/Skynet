import { execa } from 'execa';
import type { Skill, SkillResult } from '../types/index.js';

/**
 * Command execution skill
 */

export const execSkill: Skill = {
  name: 'exec',
  description: 'Execute a shell command and return its output. Use for running programs, scripts, or system commands.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute (e.g., "ls -la", "python script.py")',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (optional, defaults to workspace root)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (optional, default 30000)',
      },
    },
    required: ['command'],
  },
  async execute(params, context): Promise<SkillResult> {
    const { command, cwd, timeout } = params as {
      command: string;
      cwd?: string;
      timeout?: number;
    };
    
    try {
      const result = await execa(command, {
        shell: true,
        cwd: cwd || context.workspaceRoot,
        timeout: timeout || 30000,
        reject: false, // Don't throw on non-zero exit
        all: true, // Combine stdout and stderr
      });
      
      return {
        success: result.exitCode === 0,
        data: {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          output: result.all, // Combined output
          command,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        return {
          success: false,
          error: `Command timed out after ${timeout || 30000}ms`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const execSkills = [execSkill];
