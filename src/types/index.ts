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
  /** Thought process / streaming content captured during response generation */
  thoughtProcess?: string;
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
  | 'agent:confirm_required'  // High-risk tool needs user confirmation
  | 'agent:end'
  | 'memory:stored'
  | 'memory:recalled'
  | 'hardware:capture'
  | 'hardware:audio'
  | 'layout:update'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'task:triggered'
  | 'voice:tts_audio'       // TTS audio segment from voice service
  | 'voice:tts_start'       // TTS started for message
  | 'voice:tts_complete'    // TTS finished for message
  | 'voice:wake_status'     // Wake word state change
  | 'voice:settings'        // Voice settings update
  | 'voice:connected'       // Voice service connected
  | 'error';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: number;
}

// Tool confirmation request/response for high-risk output tools
export interface ToolConfirmationRequest {
  confirmId: string;
  runId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  riskReason: string;
}

export interface ToolConfirmationResponse {
  confirmId: string;
  approved: boolean;
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
