/**
 * Tool Call Parser - Extracts tool calls from LLM text output
 * 
 * Supports multiple formats:
 * - <tool_call>{"tool": "name", "args": {...}}</tool_call>
 * - ```tool_call {"tool": "name", "args": {...}} ```
 * - Raw JSON: {"tool": "name", "args": {...}}
 * - Raw JSON: {"name": "name", "arguments": {...}}
 */

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawMatch: string;
  startPos: number;
  endPos: number;
}

/**
 * Parser for extracting tool calls from LLM responses
 */
export class ToolCallParser {
  // Pattern to match <tool_call>...</tool_call> blocks
  private static readonly TOOL_CALL_PATTERN = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi;

  // Alternative patterns for flexibility
  private static readonly ALT_PATTERNS = [
    // Markdown code block style
    /```tool_call\s*(\{[\s\S]*?\})\s*```/g,
    // JSON block with tool key
    /```json\s*(\{"tool":\s*"[^"]+",\s*"args":\s*\{[\s\S]*?\}\})\s*```/g,
    // Raw JSON with tool key - matches {"tool": "...", "args": {...}}
    /(\{"tool":\s*"[^"]+",\s*"args":\s*\{[^}]*\}\})/g,
    // Raw JSON with args first
    /(\{"args":\s*\{[^}]*\},\s*"tool":\s*"[^"]+"\})/g,
    // Raw JSON with name/arguments format (OpenAI style output as text)
    /(\{"name":\s*"[^"]+",\s*"arguments":\s*\{[^}]*\}\})/g,
  ];

  private idCounter = 0;

  /**
   * Generate a unique ID for a tool call
   */
  private generateId(): string {
    return `tc_${Date.now()}_${++this.idCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Find all tool calls in the given text
   */
  findToolCalls(text: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = [];

    // Reset patterns (they have state due to 'g' flag)
    ToolCallParser.TOOL_CALL_PATTERN.lastIndex = 0;

    // Try main pattern first
    let match: RegExpExecArray | null;
    while ((match = ToolCallParser.TOOL_CALL_PATTERN.exec(text)) !== null) {
      const parsed = this.parseMatch(match, match[1]);
      if (parsed) {
        toolCalls.push(parsed);
      }
    }

    // If no matches, try alternative patterns
    if (toolCalls.length === 0) {
      for (const pattern of ToolCallParser.ALT_PATTERNS) {
        pattern.lastIndex = 0;
        while ((match = pattern.exec(text)) !== null) {
          const parsed = this.parseMatch(match, match[1]);
          if (parsed) {
            toolCalls.push(parsed);
          }
        }
        if (toolCalls.length > 0) {
          break; // Found matches with this pattern
        }
      }
    }

    return toolCalls;
  }

  /**
   * Parse a regex match into a ParsedToolCall
   */
  private parseMatch(match: RegExpExecArray, jsonStr: string): ParsedToolCall | null {
    try {
      const cleaned = jsonStr.trim();
      const data = JSON.parse(cleaned);

      // Handle {"tool": "name", "args": {...}} format
      if (data.tool) {
        return {
          id: this.generateId(),
          name: data.tool,
          arguments: data.args || {},
          rawMatch: match[0],
          startPos: match.index,
          endPos: match.index + match[0].length,
        };
      }

      // Handle {"name": "name", "arguments": {...}} format (OpenAI style)
      if (data.name && typeof data.name === 'string') {
        return {
          id: this.generateId(),
          name: data.name,
          arguments: data.arguments || data.args || {},
          rawMatch: match[0],
          startPos: match.index,
          endPos: match.index + match[0].length,
        };
      }

      return null;
    } catch {
      // Try to fix common JSON issues
      const fixed = this.tryFixJson(jsonStr);
      if (fixed) {
        try {
          const data = JSON.parse(fixed);
          if (data.tool || data.name) {
            return {
              id: this.generateId(),
              name: data.tool || data.name,
              arguments: data.args || data.arguments || {},
              rawMatch: match[0],
              startPos: match.index,
              endPos: match.index + match[0].length,
            };
          }
        } catch {
          // Still failed
        }
      }
      return null;
    }
  }

  /**
   * Try to fix common JSON formatting issues
   */
  private tryFixJson(jsonStr: string): string | null {
    let fixed = jsonStr;

    // Replace single quotes with double quotes
    fixed = fixed.replace(/'/g, '"');

    // Remove trailing commas before closing braces
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');

    // Add missing quotes around unquoted keys
    fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    return fixed;
  }

  /**
   * Check if text contains any tool call
   */
  hasToolCall(text: string): boolean {
    ToolCallParser.TOOL_CALL_PATTERN.lastIndex = 0;
    if (ToolCallParser.TOOL_CALL_PATTERN.test(text)) {
      return true;
    }

    for (const pattern of ToolCallParser.ALT_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if text contains a partial (incomplete) tool call
   * Useful during streaming to detect if a tool call is being formed
   */
  hasPartialToolCall(text: string): boolean {
    const lower = text.toLowerCase();

    // Check for opening tag without closing
    if (lower.includes('<tool_call>') && !lower.includes('</tool_call>')) {
      return true;
    }

    // Check for opening code block
    if (lower.includes('```tool_call') && (text.match(/```/g)?.length || 0) % 2 === 1) {
      return true;
    }

    // Check for partial raw JSON tool call
    if (text.includes('{"tool":') && !text.trim().endsWith('}')) {
      return true;
    }

    return false;
  }

  /**
   * Remove all tool calls from text, returning the clean text
   */
  removeToolCalls(text: string): string {
    let cleaned = text;

    // Remove main pattern
    cleaned = cleaned.replace(ToolCallParser.TOOL_CALL_PATTERN, '');

    // Remove alternative patterns
    for (const pattern of ToolCallParser.ALT_PATTERNS) {
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, '');
    }

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }

  /**
   * Extract the text content from a tool call JSON if present
   * Used for models that output tool calls as JSON with text content
   * e.g., {"name": "speak", "arguments": {"text": "Hello!"}}
   */
  extractTextFromToolCallJson(content: string): string | null {
    if (!content) return null;

    const trimmed = content.trim();

    // Check if content looks like a JSON tool call
    if (!trimmed.startsWith('{') || !trimmed.includes('"name"')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Check for common tool call patterns with text content
      if (parsed.name && parsed.arguments) {
        const textContent =
          parsed.arguments.text ||
          parsed.arguments.content ||
          parsed.arguments.message ||
          parsed.arguments.response;

        if (typeof textContent === 'string') {
          return textContent;
        }
      }
    } catch {
      // Not valid JSON
    }

    return null;
  }

  /**
   * Convert tool calls to speech-friendly announcements
   */
  convertToolCallsForDisplay(text: string): string {
    const toolCalls = this.findToolCalls(text);
    if (toolCalls.length === 0) return text;

    let result = text;

    // Sort by position in reverse order to replace from end to start
    toolCalls.sort((a: ParsedToolCall, b: ParsedToolCall) => b.startPos - a.startPos);

    for (const toolCall of toolCalls) {
      const announcement = `[Using tool: ${toolCall.name}]`;
      result = result.slice(0, toolCall.startPos) + announcement + result.slice(toolCall.endPos);
    }

    return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Extract text before the first tool call
   */
  extractTextBeforeToolCall(text: string): { before: string; rest: string | null } {
    const toolCalls = this.findToolCalls(text);

    if (toolCalls.length === 0) {
      return { before: text, rest: null };
    }

    // Find the earliest tool call
    const firstToolCall = toolCalls.reduce((earliest, current) =>
      current.startPos < earliest.startPos ? current : earliest
    );

    return {
      before: text.slice(0, firstToolCall.startPos).trim(),
      rest: text.slice(firstToolCall.startPos),
    };
  }
}

// Global parser instance
export const toolParser = new ToolCallParser();
