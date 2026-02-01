/**
 * Command Explanation Module
 * 
 * Provides human-readable explanations for shell commands
 * to help users understand what they're authorizing.
 */

interface CommandExplanation {
  summary: string;
  details: string;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

// Common command patterns and their explanations
const COMMAND_PATTERNS: Record<string, (args: string[]) => CommandExplanation> = {
  // File viewing
  'cat': (args) => ({
    summary: 'View file contents',
    details: `Display the contents of: ${args.join(', ') || 'file(s)'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'less': (args) => ({
    summary: 'View file contents (paginated)',
    details: `Open file viewer for: ${args[0] || 'file'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'more': (args) => ({
    summary: 'View file contents (paginated)',
    details: `Open file viewer for: ${args[0] || 'file'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'head': (args) => ({
    summary: 'View beginning of file',
    details: `Show first lines of: ${args.filter(a => !a.startsWith('-')).join(', ') || 'file'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'tail': (args) => ({
    summary: 'View end of file',
    details: `Show last lines of: ${args.filter(a => !a.startsWith('-')).join(', ') || 'file'}`,
    riskLevel: 'low',
    warnings: [],
  }),

  // Directory operations
  'ls': (args) => ({
    summary: 'List directory contents',
    details: `Show files in: ${args.filter(a => !a.startsWith('-'))[0] || 'current directory'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'pwd': () => ({
    summary: 'Show current directory',
    details: 'Print the current working directory path',
    riskLevel: 'low',
    warnings: [],
  }),
  'cd': (args) => ({
    summary: 'Change directory',
    details: `Navigate to: ${args[0] || 'home directory'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'mkdir': (args) => ({
    summary: 'Create directory',
    details: `Create new folder: ${args.filter(a => !a.startsWith('-')).join(', ')}`,
    riskLevel: 'medium',
    warnings: [],
  }),

  // File operations - DESTRUCTIVE
  'rm': (args) => {
    const warnings: string[] = [];
    const hasRecursive = args.some(a => a.includes('r'));
    const hasForce = args.some(a => a.includes('f'));
    const files = args.filter(a => !a.startsWith('-'));
    
    if (hasRecursive) warnings.push('Recursive deletion - will delete directories and all contents');
    if (hasForce) warnings.push('Force mode - will not ask for confirmation');
    if (files.some(f => f === '/' || f === '~' || f === '*')) {
      warnings.push('DANGEROUS: Targets root, home, or wildcard - could delete important files');
    }
    
    return {
      summary: 'Delete files/folders',
      details: `Remove: ${files.join(', ') || 'specified items'}`,
      riskLevel: hasRecursive || hasForce ? 'high' : 'medium',
      warnings,
    };
  },
  'rmdir': (args) => ({
    summary: 'Remove empty directory',
    details: `Delete empty folder: ${args.filter(a => !a.startsWith('-')).join(', ')}`,
    riskLevel: 'medium',
    warnings: [],
  }),
  'mv': (args) => {
    const files = args.filter(a => !a.startsWith('-'));
    return {
      summary: 'Move/rename files',
      details: files.length >= 2 
        ? `Move ${files.slice(0, -1).join(', ')} to ${files[files.length - 1]}`
        : 'Move files to destination',
      riskLevel: 'medium',
      warnings: files.some(f => f === '/' || f === '~') ? ['Moving system directories can be dangerous'] : [],
    };
  },
  'cp': (args) => {
    const files = args.filter(a => !a.startsWith('-'));
    return {
      summary: 'Copy files',
      details: files.length >= 2
        ? `Copy ${files.slice(0, -1).join(', ')} to ${files[files.length - 1]}`
        : 'Copy files to destination',
      riskLevel: 'low',
      warnings: [],
    };
  },

  // Text processing
  'grep': (args) => ({
    summary: 'Search text patterns',
    details: `Search for "${args[0] || 'pattern'}" in files`,
    riskLevel: 'low',
    warnings: [],
  }),
  'sed': (args) => ({
    summary: 'Stream editor - modify text',
    details: args.some(a => a === '-i') ? 'Edit files in-place' : 'Process text stream',
    riskLevel: args.some(a => a === '-i') ? 'medium' : 'low',
    warnings: args.some(a => a === '-i') ? ['In-place editing modifies original files'] : [],
  }),
  'awk': () => ({
    summary: 'Text processing',
    details: 'Process and transform text data',
    riskLevel: 'low',
    warnings: [],
  }),

  // Network
  'curl': (args) => {
    const hasOutput = args.some(a => a === '-o' || a === '-O' || a === '--output');
    const hasPost = args.some(a => a === '-X' || a === '--request' || a === '-d' || a === '--data');
    const url = args.find(a => a.startsWith('http'));
    
    return {
      summary: hasPost ? 'Send HTTP request' : 'Download from URL',
      details: url ? `Request to: ${url}` : 'Make HTTP request',
      riskLevel: hasPost ? 'medium' : 'low',
      warnings: hasOutput ? ['Will save downloaded content to a file'] : [],
    };
  },
  'wget': (args) => {
    const url = args.find(a => a.startsWith('http'));
    return {
      summary: 'Download file from URL',
      details: url ? `Download: ${url}` : 'Download from URL',
      riskLevel: 'low',
      warnings: ['Will create a file in current directory'],
    };
  },
  'ssh': (args) => ({
    summary: 'Connect to remote server',
    details: `SSH connection to: ${args.filter(a => !a.startsWith('-'))[0] || 'remote host'}`,
    riskLevel: 'medium',
    warnings: ['Establishes connection to external server'],
  }),
  'scp': (_args) => ({
    summary: 'Copy files over SSH',
    details: 'Transfer files to/from remote server',
    riskLevel: 'medium',
    warnings: ['Transfers files over network'],
  }),

  // Package managers
  'npm': (args) => {
    const subcommand = args[0];
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (subcommand === 'install' || subcommand === 'i') {
      warnings.push('Will download and install packages from npm registry');
      riskLevel = 'medium';
    } else if (subcommand === 'run') {
      warnings.push('Will execute a script from package.json');
      riskLevel = 'medium';
    }
    
    return {
      summary: `npm ${subcommand || 'command'}`,
      details: `Node.js package manager: ${args.join(' ')}`,
      riskLevel,
      warnings,
    };
  },
  'pip': (args) => {
    const subcommand = args[0];
    return {
      summary: `pip ${subcommand || 'command'}`,
      details: `Python package manager: ${args.join(' ')}`,
      riskLevel: subcommand === 'install' ? 'medium' : 'low',
      warnings: subcommand === 'install' ? ['Will download and install Python packages'] : [],
    };
  },
  'pip3': (args) => COMMAND_PATTERNS['pip'](args),
  'yarn': (args) => ({
    summary: `yarn ${args[0] || 'command'}`,
    details: `Yarn package manager: ${args.join(' ')}`,
    riskLevel: args[0] === 'add' || args[0] === 'install' ? 'medium' : 'low',
    warnings: args[0] === 'add' ? ['Will install packages'] : [],
  }),
  'brew': (args) => ({
    summary: `brew ${args[0] || 'command'}`,
    details: `Homebrew: ${args.join(' ')}`,
    riskLevel: args[0] === 'install' ? 'medium' : 'low',
    warnings: args[0] === 'install' ? ['Will install software via Homebrew'] : [],
  }),

  // Git
  'git': (args) => {
    const subcommand = args[0];
    let summary = `git ${subcommand || 'command'}`;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const warnings: string[] = [];
    
    switch (subcommand) {
      case 'push':
        summary = 'Push changes to remote';
        riskLevel = 'medium';
        warnings.push('Will upload commits to remote repository');
        if (args.includes('--force') || args.includes('-f')) {
          riskLevel = 'high';
          warnings.push('Force push can overwrite remote history');
        }
        break;
      case 'reset':
        summary = 'Reset repository state';
        riskLevel = args.includes('--hard') ? 'high' : 'medium';
        if (args.includes('--hard')) {
          warnings.push('Hard reset will discard uncommitted changes');
        }
        break;
      case 'clean':
        summary = 'Remove untracked files';
        riskLevel = 'medium';
        warnings.push('Will delete untracked files from working directory');
        break;
      case 'clone':
        summary = 'Clone repository';
        break;
      case 'pull':
        summary = 'Pull remote changes';
        break;
      case 'commit':
        summary = 'Create a commit';
        break;
      case 'status':
      case 'log':
      case 'diff':
      case 'branch':
        summary = `Show git ${subcommand}`;
        break;
    }
    
    return { summary, details: `Git: ${args.join(' ')}`, riskLevel, warnings };
  },

  // System
  'sudo': (args) => ({
    summary: 'Run as administrator',
    details: `Execute with elevated privileges: ${args.join(' ')}`,
    riskLevel: 'high',
    warnings: ['Runs command with root/admin privileges', 'Can modify system files and settings'],
  }),
  'chmod': (args) => ({
    summary: 'Change file permissions',
    details: `Modify permissions: ${args.filter(a => !a.startsWith('-')).join(' ')}`,
    riskLevel: 'medium',
    warnings: ['Changes who can read, write, or execute files'],
  }),
  'chown': (args) => ({
    summary: 'Change file ownership',
    details: `Change owner of: ${args.filter(a => !a.startsWith('-')).slice(1).join(', ')}`,
    riskLevel: 'medium',
    warnings: ['Changes file ownership'],
  }),
  'kill': (args) => ({
    summary: 'Terminate process',
    details: `Stop process: ${args.filter(a => !a.startsWith('-')).join(', ')}`,
    riskLevel: 'medium',
    warnings: ['Will terminate running processes'],
  }),
  'killall': (args) => ({
    summary: 'Terminate processes by name',
    details: `Stop all processes named: ${args.filter(a => !a.startsWith('-')).join(', ')}`,
    riskLevel: 'medium',
    warnings: ['Will terminate all matching processes'],
  }),

  // Docker
  'docker': (args) => {
    const subcommand = args[0];
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    const warnings: string[] = [];
    
    if (subcommand === 'run') {
      warnings.push('Will start a container');
      if (args.includes('--privileged')) {
        riskLevel = 'high';
        warnings.push('Privileged mode gives container full host access');
      }
    } else if (subcommand === 'rm' || subcommand === 'rmi') {
      warnings.push('Will remove containers or images');
    }
    
    return {
      summary: `Docker ${subcommand || 'command'}`,
      details: `Docker: ${args.join(' ')}`,
      riskLevel,
      warnings,
    };
  },

  // Build tools
  'make': (args) => ({
    summary: 'Run build tasks',
    details: `Make target: ${args[0] || 'default'}`,
    riskLevel: 'medium',
    warnings: ['Executes commands defined in Makefile'],
  }),

  // Python
  'python': (args) => ({
    summary: 'Run Python script',
    details: args[0] ? `Execute: ${args[0]}` : 'Start Python interpreter',
    riskLevel: 'medium',
    warnings: args[0] ? ['Will execute Python code'] : [],
  }),
  'python3': (args) => COMMAND_PATTERNS['python'](args),

  // Node
  'node': (args) => ({
    summary: 'Run Node.js script',
    details: args[0] ? `Execute: ${args[0]}` : 'Start Node.js REPL',
    riskLevel: 'medium',
    warnings: args[0] ? ['Will execute JavaScript code'] : [],
  }),

  // Misc
  'echo': (args) => ({
    summary: 'Print text',
    details: `Output: ${args.join(' ')}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'which': (args) => ({
    summary: 'Find command location',
    details: `Locate: ${args[0] || 'command'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'whoami': () => ({
    summary: 'Show current user',
    details: 'Display the current username',
    riskLevel: 'low',
    warnings: [],
  }),
  'date': () => ({
    summary: 'Show date/time',
    details: 'Display current date and time',
    riskLevel: 'low',
    warnings: [],
  }),
  'env': () => ({
    summary: 'Show environment variables',
    details: 'List all environment variables',
    riskLevel: 'low',
    warnings: [],
  }),
  'export': (args) => ({
    summary: 'Set environment variable',
    details: `Set: ${args[0] || 'variable'}`,
    riskLevel: 'low',
    warnings: [],
  }),
  'sleep': (args) => ({
    summary: 'Pause execution',
    details: `Wait for ${args[0] || '?'} seconds`,
    riskLevel: 'low',
    warnings: [],
  }),
  'open': (args) => ({
    summary: 'Open file/URL',
    details: `Open: ${args.filter(a => !a.startsWith('-'))[0] || 'item'}`,
    riskLevel: 'low',
    warnings: args.some(a => a.startsWith('http')) ? ['Will open a URL in browser'] : [],
  }),
};

/**
 * Parse a command string into base command and arguments
 */
function parseCommand(command: string): { base: string; args: string[] } {
  // Handle common patterns
  const trimmed = command.trim();
  
  // Handle pipes - explain just the first command for now
  const pipeIndex = trimmed.indexOf('|');
  const relevantPart = pipeIndex > 0 ? trimmed.slice(0, pipeIndex).trim() : trimmed;
  
  // Handle redirects
  const redirectIndex = relevantPart.search(/[<>]/);
  const commandPart = redirectIndex > 0 ? relevantPart.slice(0, redirectIndex).trim() : relevantPart;
  
  // Split into parts (simple tokenization)
  const parts = commandPart.split(/\s+/).filter(Boolean);
  const base = parts[0] || '';
  const args = parts.slice(1);
  
  return { base, args };
}

/**
 * Explain a shell command in human-readable terms
 */
export function explainCommand(command: string): CommandExplanation {
  const { base, args } = parseCommand(command);
  
  // Look up the command pattern
  const explainer = COMMAND_PATTERNS[base];
  if (explainer) {
    return explainer(args);
  }
  
  // Unknown command - provide generic explanation
  return {
    summary: `Run: ${base}`,
    details: command.length > 80 ? command.slice(0, 77) + '...' : command,
    riskLevel: 'medium',
    warnings: ['Unknown command - review carefully before approving'],
  };
}

/**
 * Get a brief one-line explanation suitable for display
 */
export function getCommandSummary(command: string): string {
  const explanation = explainCommand(command);
  return explanation.summary;
}

/**
 * Get risk level color for UI
 */
export function getRiskColor(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'low':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    case 'high':
      return 'text-red-400';
  }
}
