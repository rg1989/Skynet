import type { Message, Session, Skill } from '../types/index.js';
import type { Config } from '../config/schema.js';
import { getRuntimeConfig } from '../config/runtime.js';
import { getPersona } from './personas.js';
import { SECURITY_INSTRUCTIONS } from './security.js';

/**
 * Context builder - assembles messages for LLM
 */

export type ToolsMode = 'hybrid' | 'native' | 'text' | 'disabled';

export interface ContextBuildParams {
  session: Session;
  config: Config;
  skills: Skill[];
  allSkillNames?: string[]; // All available skill names (for knowledge, even if disabled)
  maxTokens?: number;
  toolsEnabled?: boolean;
  toolsMode?: ToolsMode;
  persona?: string; // Persona ID (e.g., 'hawking', 'default')
}

export interface BuiltContext {
  messages: Message[];
  tools: Skill[];
  maxOutputTokens: number;
  toolsMode: ToolsMode;
}

/**
 * Generate tool knowledge section - informs the model what tools exist (even if disabled)
 * This enables the model to know what it can enable on demand
 */
function generateToolKnowledge(allSkills: Skill[], enabledSkills: Skill[]): string {
  if (allSkills.length === 0) return '';

  const enabledNames = new Set(enabledSkills.map(s => s.name));
  
  // Group skills by category for cleaner presentation
  const categories: Record<string, Skill[]> = {
    'Self-Config': [],
    'File Operations': [],
    'Execution': [],
    'Web': [],
    'Memory': [],
    'Vision': [],
    'Audio': [],
    'Gmail': [],
    'Other': [],
  };

  for (const skill of allSkills) {
    if (skill.name.includes('config') || skill.name.includes('tool') || skill.name.includes('provider') || skill.name.includes('model') || skill.name.includes('prompt')) {
      categories['Self-Config'].push(skill);
    } else if (skill.name.includes('file') || skill.name.includes('directory') || skill.name.includes('read') || skill.name.includes('write') || skill.name.includes('edit') || skill.name.includes('list_dir')) {
      categories['File Operations'].push(skill);
    } else if (skill.name.includes('exec')) {
      categories['Execution'].push(skill);
    } else if (skill.name.includes('web') || skill.name.includes('fetch') || skill.name.includes('search') && !skill.name.includes('memory')) {
      categories['Web'].push(skill);
    } else if (skill.name.includes('memory') || skill.name.includes('remember') || skill.name.includes('recall') || skill.name.includes('fact') || skill.name.includes('forget')) {
      categories['Memory'].push(skill);
    } else if (skill.name.includes('screenshot') || skill.name.includes('photo') || skill.name.includes('image') || skill.name.includes('vision')) {
      categories['Vision'].push(skill);
    } else if (skill.name.includes('audio') || skill.name.includes('record') || skill.name.includes('transcribe') || skill.name.includes('speak') || skill.name.includes('play')) {
      categories['Audio'].push(skill);
    } else if (skill.name.includes('gmail') || skill.name.includes('email')) {
      categories['Gmail'].push(skill);
    } else {
      categories['Other'].push(skill);
    }
  }

  const categoryList = Object.entries(categories)
    .filter(([_, skills]) => skills.length > 0)
    .map(([category, skills]) => {
      const skillList = skills.map(s => {
        const status = enabledNames.has(s.name) ? '✓' : '○';
        return `  ${status} ${s.name}: ${s.description}`;
      }).join('\n');
      return `**${category}:**\n${skillList}`;
    }).join('\n\n');

  return `
## Available Tools (Knowledge)

The following tools are available in this system. Tools marked with ✓ are currently enabled, ○ are disabled.
You can enable any disabled tool by using the \`enable_tool\` skill with the tool name.

${categoryList}

**Note:** By default, most tools are disabled to keep responses lightweight. Enable tools as needed for tasks.
`;
}

/**
 * Generate tool instructions for text-based tool calling
 */
function generateToolInstructions(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const toolList = skills.map(skill => {
    const argsDesc = skill.parameters?.properties
      ? Object.entries(skill.parameters.properties as Record<string, { description?: string }>)
          .map(([key, val]) => `    - ${key}: ${val.description || 'No description'}`)
          .join('\n')
      : '    (no arguments)';
    return `**${skill.name}**: ${skill.description}\n${argsDesc}`;
  }).join('\n\n');

  return `
## Enabled Tools (Active)

You have the following tools ENABLED and ready to use. When you need to use a tool, output a tool call in this EXACT format:

<tool_call>
{"tool": "tool_name", "args": {"arg1": "value1", "arg2": "value2"}}
</tool_call>

After receiving tool results, incorporate them naturally into your response.

### Active Tools:

${toolList}

### Examples:

User: "What time is it?"
<tool_call>
{"tool": "get_date", "args": {}}
</tool_call>

User: "Search for Python tutorials"
<tool_call>
{"tool": "web_search", "args": {"query": "Python tutorials"}}
</tool_call>

IMPORTANT:
- Use the EXACT format shown above with <tool_call> tags
- Always include valid JSON inside the tags
- You can output text before or after tool calls
- Wait for tool results before providing final answers
- If you need a tool that's not in the active list, use enable_tool first
`;
}

/**
 * Build system prompt
 */
function buildSystemPrompt(config: Config, toolsMode: ToolsMode, enabledSkills: Skill[], allSkills: Skill[], personaId?: string): string {
  // Check for persona-specific prompt
  const persona = personaId ? getPersona(personaId) : null;
  const personaPrompt = persona?.systemPrompt;

  // If tools are disabled, use a simpler prompt without tool mentions
  if (toolsMode === 'disabled') {
    // Use persona prompt if available, otherwise default
    return personaPrompt || config.agent.systemPrompt || `You are Skynet, a helpful personal AI assistant.

Be helpful, accurate, and conversational. Answer questions directly and naturally.
Do not attempt to use tools, functions, or output JSON - just respond in plain text.`;
  }

  // Use persona prompt as base if available
  const basePrompt = personaPrompt || config.agent.systemPrompt || `You are Skynet, a helpful personal AI assistant.

You have access to various tools to help the user with tasks. Most tools are disabled by default to keep API calls lightweight, but you can enable any tool you need using the \`enable_tool\` skill.

Tool categories available:
- Self-Config: Always enabled - manage tools, providers, and your own configuration
- File Operations: Read, write, edit files (enable as needed)
- Execution: Run shell commands (enable as needed)
- Web: Fetch pages, search the web (enable as needed)
- Vision: Screenshots, photos, image analysis (enable as needed)
- Audio: Record, transcribe, speak (enable as needed)
- Memory: Remember and recall information (enable as needed)
- Gmail: Read and send emails (enable as needed)

Always be helpful, accurate, and proactive. When you need a capability that's not enabled, use \`enable_tool\` first.
After completing a task, summarize what was done.`;

  // Add memory context if enabled
  const memorySection = config.agent.memory?.enabled
    ? `\n\nYou have access to a persistent memory system (when enabled). Memory tools include:
- remember_fact: Store important facts
- recall_fact: Recall stored facts
- remember: Store longer memories for semantic search
- search_memory: Search your memories`
    : '';

  // Generate tool knowledge section (all tools, enabled status)
  const toolKnowledge = generateToolKnowledge(allSkills, enabledSkills);

  // Add tool instructions for text-based or hybrid mode (only enabled tools)
  const toolInstructions = (toolsMode === 'text' || toolsMode === 'hybrid')
    ? generateToolInstructions(enabledSkills)
    : '';

  // Append security instructions to help defend against prompt injection
  return basePrompt + memorySection + toolKnowledge + toolInstructions + SECURITY_INSTRUCTIONS;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Build context for agent execution
 */
export function buildContext(params: ContextBuildParams): BuiltContext {
  const { session, config, skills, toolsEnabled = true, persona } = params;
  
  // Determine tools mode
  let toolsMode: ToolsMode = params.toolsMode || 'hybrid';
  if (!toolsEnabled) {
    toolsMode = 'disabled';
  }
  
  // Filter out disabled tools using runtime config
  const runtimeConfig = getRuntimeConfig();
  const enabledSkills = skills.filter(s => runtimeConfig.isToolEnabled(s.name));
  
  // Build system prompt with tool knowledge (all skills) and instructions (enabled only)
  const systemPrompt = buildSystemPrompt(config, toolsMode, enabledSkills, skills, persona);
  
  // Start with system message
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
  ];
  
  // Calculate available tokens for history
  const maxContextTokens = params.maxTokens || 100000;
  const reserveForOutput = config.agent.maxTokens || 4096;
  const systemTokens = estimateTokens(systemPrompt);
  const availableForHistory = maxContextTokens - systemTokens - reserveForOutput - 1000; // 1000 buffer
  
  // Add session messages (most recent first, then reverse)
  let historyTokens = 0;
  const historyMessages: Message[] = [];
  
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    const msgTokens = estimateTokens(msg.content);
    
    if (historyTokens + msgTokens > availableForHistory) {
      // Context full, stop adding
      break;
    }
    
    historyMessages.unshift({
      role: msg.role,
      content: msg.content,
      toolCallId: msg.toolCallId,
    });
    historyTokens += msgTokens;
  }
  
  // Add history to messages
  messages.push(...historyMessages);
  
  return {
    messages,
    tools: toolsMode === 'disabled' ? [] : enabledSkills,
    maxOutputTokens: reserveForOutput,
    toolsMode,
  };
}

/**
 * Add tool result to context
 */
export function addToolResult(
  messages: Message[],
  toolCallId: string,
  result: string
): Message[] {
  return [
    ...messages,
    {
      role: 'tool' as const,
      content: result,
      toolCallId,
    },
  ];
}

/**
 * Add assistant message to context
 */
export function addAssistantMessage(
  messages: Message[],
  content: string
): Message[] {
  return [
    ...messages,
    {
      role: 'assistant' as const,
      content,
    },
  ];
}

/**
 * Add assistant message with tool calls to context
 * This is needed for Anthropic API which requires tool_use blocks in assistant messages
 * before corresponding tool_result blocks in user messages
 */
export function addAssistantToolCalls(
  messages: Message[],
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  textContent?: string
): Message[] {
  return [
    ...messages,
    {
      role: 'assistant' as const,
      content: textContent || '', // Can have both text and tool calls
      toolCalls,
    },
  ];
}
