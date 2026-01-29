import { create } from 'zustand';

// LocalStorage keys
const STORAGE_KEY_SESSION = 'skynet_current_session';

// Get initial session key from localStorage or generate new one
function getInitialSessionKey(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    if (stored) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return ''; // Will be set after fetching sessions
}

// Save session key to localStorage
function saveSessionKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, key);
  } catch {
    // localStorage not available
  }
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: boolean;
  toolCalls?: { name: string; status: 'running' | 'done'; result?: string }[];
  /** Thought process / steps the AI took while generating this response */
  thoughtProcess?: string;
}

export interface SessionInfo {
  key: string;
  messageCount: number;
  lastActivity: number;
  createdAt: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface ProviderInfo {
  name: string;
  model: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
  enabled: boolean;
}

// Tool confirmation request for high-risk output tools
export interface ToolConfirmationRequest {
  confirmId: string;
  runId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  riskReason: string;
}

export type ToolsMode = 'hybrid' | 'native' | 'text' | 'disabled';

export type AvatarDesign = '3d';

// LocalStorage key for avatar mode settings
const STORAGE_KEY_AVATAR = 'skynet_avatar_mode';

export interface Settings {
  // Provider/Model
  currentProvider: string;
  currentModel: string;
  providers: ProviderInfo[];
  availableModels: { name: string; description?: string; size?: number }[];
  
  // Tools
  tools: ToolInfo[];
  toolsMode: ToolsMode;
  
  // System prompt
  systemPrompt: string;
  isDefaultPrompt: boolean;
  
  // Loading states
  loading: boolean;
  warmingUp: boolean;
}

// Get initial avatar mode settings from localStorage
function getInitialAvatarSettings(): {
  enabled: boolean;
  design: AvatarDesign;
  ttsEnabled: boolean;
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_AVATAR);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Always use '3d' design (other designs have been removed)
      return { ...parsed, design: '3d' as AvatarDesign };
    }
  } catch {
    // localStorage not available or invalid JSON
  }
  return { enabled: false, design: '3d', ttsEnabled: true };
}

// Save avatar settings to localStorage
function saveAvatarSettings(settings: { enabled: boolean; design: AvatarDesign; ttsEnabled: boolean }): void {
  try {
    localStorage.setItem(STORAGE_KEY_AVATAR, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Sessions
  sessions: SessionInfo[];
  currentSessionKey: string;
  setSessions: (sessions: SessionInfo[]) => void;
  setCurrentSession: (key: string) => void;
  removeSession: (key: string) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // Active task
  activeRunId: string | null;
  setActiveRunId: (runId: string | null) => void;
  isThinking: boolean; // True when waiting for first token
  setIsThinking: (thinking: boolean) => void;
  thinkingContent: string;
  setThinkingContent: (content: string) => void;
  appendThinkingContent: (delta: string) => void;

  // Voice input
  isListening: boolean; // True when speech recognition is active
  setIsListening: (listening: boolean) => void;
  isTranscribing: boolean; // True when processing speech to text
  setIsTranscribing: (transcribing: boolean) => void;

  // Tool execution
  activeTools: { name: string; params?: unknown }[];
  addActiveTool: (name: string, params?: unknown) => void;
  removeActiveTool: (name: string) => void;
  clearActiveTools: () => void;

  // Scheduled tasks
  tasks: ScheduledTask[];
  setTasks: (tasks: ScheduledTask[]) => void;
  addTask: (task: ScheduledTask) => void;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => void;
  removeTask: (id: string) => void;

  // Settings
  settings: Settings;
  setSettings: (updates: Partial<Settings>) => void;
  
  // Legacy provider (for backwards compatibility)
  provider: string;
  setProvider: (provider: string) => void;

  // Avatar Mode
  avatarModeEnabled: boolean;
  setAvatarModeEnabled: (enabled: boolean) => void;
  avatarDesign: AvatarDesign;
  setAvatarDesign: (design: AvatarDesign) => void;
  avatarRatio: number; // 0.2 to 0.8, default 0.4 (40% avatar, 60% chat)
  setAvatarRatio: (ratio: number) => void;
  showContent: boolean;
  setShowContent: (show: boolean) => void;
  contentUrl: string | null;
  setContentUrl: (url: string | null) => void;
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  
  // Tool confirmation for high-risk output tools
  pendingConfirmation: ToolConfirmationRequest | null;
  setPendingConfirmation: (confirmation: ToolConfirmationRequest | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Sessions
  sessions: [],
  currentSessionKey: getInitialSessionKey(),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (key) => {
    saveSessionKey(key);
    set({ currentSessionKey: key, messages: [] });
  },
  removeSession: (key) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.key !== key),
    })),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  // Active task
  activeRunId: null,
  setActiveRunId: (runId) => set({ activeRunId: runId }),
  isThinking: false,
  setIsThinking: (thinking) => set({ isThinking: thinking }),
  thinkingContent: '',
  setThinkingContent: (content) => set({ thinkingContent: content }),
  appendThinkingContent: (delta) =>
    set((state) => ({ thinkingContent: state.thinkingContent + delta })),

  // Voice input
  isListening: false,
  setIsListening: (listening) => set({ isListening: listening }),
  isTranscribing: false,
  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),

  // Tool execution
  activeTools: [],
  addActiveTool: (name, params) =>
    set((state) => ({ activeTools: [...state.activeTools, { name, params }] })),
  removeActiveTool: (name) =>
    set((state) => ({
      activeTools: state.activeTools.filter((t) => t.name !== name),
    })),
  clearActiveTools: () => set({ activeTools: [] }),

  // Scheduled tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  // Settings - default to empty, will be populated from API
  settings: {
    currentProvider: '',
    currentModel: '',
    providers: [],
    availableModels: [],
    tools: [],
    toolsMode: 'hybrid',
    systemPrompt: '',
    isDefaultPrompt: true,
    loading: true, // Start as loading until API responds
    warmingUp: false,
  },
  setSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  // Legacy provider (for backwards compatibility) - empty by default
  provider: '',
  setProvider: (provider) => set({ provider }),

  // Avatar Mode - initialized from localStorage
  avatarModeEnabled: getInitialAvatarSettings().enabled,
  setAvatarModeEnabled: (enabled) => {
    set((state) => {
      saveAvatarSettings({ enabled, design: state.avatarDesign, ttsEnabled: state.ttsEnabled });
      return { avatarModeEnabled: enabled };
    });
  },
  avatarDesign: getInitialAvatarSettings().design,
  setAvatarDesign: (design) => {
    set((state) => {
      saveAvatarSettings({ enabled: state.avatarModeEnabled, design, ttsEnabled: state.ttsEnabled });
      return { avatarDesign: design };
    });
  },
  avatarRatio: 0.4, // 40% avatar, 60% chat
  setAvatarRatio: (ratio) => set({ avatarRatio: Math.min(0.8, Math.max(0.2, ratio)) }),
  showContent: false,
  setShowContent: (show) => set({ showContent: show }),
  contentUrl: null,
  setContentUrl: (url) => set({ contentUrl: url }),
  ttsEnabled: getInitialAvatarSettings().ttsEnabled,
  setTtsEnabled: (enabled) => {
    set((state) => {
      saveAvatarSettings({ enabled: state.avatarModeEnabled, design: state.avatarDesign, ttsEnabled: enabled });
      return { ttsEnabled: enabled };
    });
  },
  
  // Tool confirmation for high-risk output tools
  pendingConfirmation: null,
  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
}));
