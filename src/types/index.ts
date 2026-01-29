/**
 * Core types for Skynet Lite
 */

// Message types for LLM communication
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[]; // For assistant messages that include tool calls
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatChunk {
  delta?: string;
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length';
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Skill (Tool) definition
export interface Skill {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
  execute: (params: Record<string, unknown>, context: SkillContext) => Promise<SkillResult>;
}

export interface SkillContext {
  workspaceRoot: string;
  sessionKey: string;
  config: import('../config/schema.js').Config;
  broadcast: (event: string, payload: unknown) => void;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  // For media results
  media?: {
    type: 'image' | 'audio' | 'video' | 'document';
    path: string;
    base64?: string;
    mimeType?: string;
  };
}

// Session types
export interface SessionMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  timestamp: number;
  media?: {
    type: string;
    path?: string;
    base64?: string;
  }[];
}

export interface Session {
  key: string;
  agentId: string;
  messages: SessionMessage[];
  createdAt: number;
  updatedAt: number;
}

// Scheduled task types
export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
  lastResult?: {
    status: 'success' | 'error';
    message?: string;
  };
}

// WebSocket event types
export type WSEventType =
  | 'agent:start'
  | 'agent:thinking'
  | 'agent:token'
  | 'agent:tool_start'
  | 'agent:tool_end'
  | 'agent:end'
  | 'memory:stored'
  | 'memory:recalled'
  | 'hardware:capture'
  | 'hardware:audio'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'task:triggered'
  | 'error';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: number;
}

// Memory types
export interface Fact {
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Memory {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
}

// Hardware types
export type Platform = 'linux' | 'darwin' | 'win32';

export interface RecordingHandle {
  pid: number;
  outputPath: string;
}

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
