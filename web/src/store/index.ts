import { create } from 'zustand';

// LocalStorage keys
const STORAGE_KEY_SESSION = 'skynet_current_session';
const STORAGE_KEY_VOICE = 'skynet_voice_settings';

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

// Get initial voice settings from localStorage
function getInitialVoiceSettings(): VoiceSettings {
  const defaults: VoiceSettings = {
    ttsEnabled: false,
    ttsMuted: false,
    ttsVoice: 'af_heart',
    ttsSpeed: 1.1,
    wakeWordEnabled: false,
    wakeWordModel: 'hey_jarvis',
    wakeWordThreshold: 0.5,
    wakeWordTimeoutSeconds: 10,
  };
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VOICE);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch {
    // localStorage not available or parse error
  }
  return defaults;
}

// Save voice settings to localStorage
function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

// Media attachment for messages
export interface MessageMedia {
  type: 'image' | 'audio' | 'video' | 'document';
  url: string; // URL to fetch the media from server
  mimeType?: string;
  caption?: string;
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
  /** Media attachments (images, audio, etc.) */
  media?: MessageMedia[];
}

// Session source types for grouping
export type SessionSource = 'telegram' | 'whatsapp' | 'web' | 'other';

export interface SessionInfo {
  key: string;
  messageCount: number;
  lastActivity: number;
  createdAt: number;
  /** Source type inferred from session key pattern */
  source: SessionSource;
  /** Human-readable title for the session */
  title?: string;
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

// Authorization scope levels for persistent approvals
export type AuthorizationScope = 'exact' | 'pattern' | 'tool';

// Tool confirmation request for high-risk output tools
export interface ToolConfirmationRequest {
  confirmId: string;
  runId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  riskReason: string;
  // Extended fields for authorization
  commandExplanation?: {
    summary: string;
    details: string;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
  };
  suggestedScopes?: AuthorizationScope[];
  canRemember?: boolean;
}

export type ToolsMode = 'hybrid' | 'native' | 'text' | 'disabled';

// Voice settings
export interface VoiceSettings {
  // TTS settings
  ttsEnabled: boolean;
  ttsMuted: boolean;  // Muted in chat, but still enabled in settings
  ttsVoice: string;
  ttsSpeed: number;
  
  // Wake word settings
  wakeWordEnabled: boolean;
  wakeWordModel: string;
  wakeWordThreshold: number;
  wakeWordTimeoutSeconds: number;
}

export type WakeWordStatus = 'listening' | 'active' | 'disabled';

// Toast notification
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
  duration: number; // ms
  createdAt: number;
}

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

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Onboarding
  needsOnboarding: boolean;
  setNeedsOnboarding: (needs: boolean) => void;
  onboardingFacts: Record<string, string>;
  setOnboardingFacts: (facts: Record<string, string>) => void;

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

  // Pending media from tool results (collected during agent run)
  pendingMedia: MessageMedia[];
  addPendingMedia: (media: MessageMedia) => void;
  clearPendingMedia: () => void;
  consumePendingMedia: () => MessageMedia[];

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
  
  // Tool confirmation for high-risk output tools
  pendingConfirmation: ToolConfirmationRequest | null;
  setPendingConfirmation: (confirmation: ToolConfirmationRequest | null) => void;

  // Toast notifications
  toasts: ToastMessage[];
  addToast: (toast: ToastMessage) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // Voice settings and state
  voiceSettings: VoiceSettings;
  setVoiceSettings: (updates: Partial<VoiceSettings>) => void;
  voiceServiceAvailable: boolean;
  setVoiceServiceAvailable: (available: boolean) => void;
  wakeWordStatus: WakeWordStatus;
  setWakeWordStatus: (status: WakeWordStatus) => void;
  isTtsSpeaking: boolean;
  setIsTtsSpeaking: (speaking: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Onboarding
  needsOnboarding: false,
  setNeedsOnboarding: (needs) => set({ needsOnboarding: needs }),
  onboardingFacts: {},
  setOnboardingFacts: (facts) => set({ onboardingFacts: facts }),

  // Sessions
  sessions: [],
  currentSessionKey: getInitialSessionKey(),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (key) => {
    saveSessionKey(key);
    set({ currentSessionKey: key, messages: [] });
  },
  removeSession: (key: string) =>
    set((state: AppState) => ({
      sessions: state.sessions.filter((s: SessionInfo) => s.key !== key),
    })),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message: Message) =>
    set((state: AppState) => ({ messages: [...state.messages, message] })),
  updateMessage: (id: string, updates: Partial<Message>) =>
    set((state: AppState) => ({
      messages: state.messages.map((m: Message) =>
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
  appendThinkingContent: (delta: string) =>
    set((state: AppState) => ({ thinkingContent: state.thinkingContent + delta })),

  // Voice input
  isListening: false,
  setIsListening: (listening) => set({ isListening: listening }),
  isTranscribing: false,
  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),

  // Tool execution
  activeTools: [],
  addActiveTool: (name: string, params?: unknown) =>
    set((state: AppState) => ({ activeTools: [...state.activeTools, { name, params }] })),
  removeActiveTool: (name: string) =>
    set((state: AppState) => ({
      activeTools: state.activeTools.filter((t: { name: string; params?: unknown }) => t.name !== name),
    })),
  clearActiveTools: () => set({ activeTools: [] }),

  // Pending media from tool results
  pendingMedia: [],
  addPendingMedia: (media: MessageMedia) =>
    set((state: AppState) => ({ pendingMedia: [...state.pendingMedia, media] })),
  clearPendingMedia: () => set({ pendingMedia: [] }),
  consumePendingMedia: () => {
    const media = get().pendingMedia;
    set({ pendingMedia: [] });
    return media;
  },

  // Scheduled tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task: ScheduledTask) => set((state: AppState) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id: string, updates: Partial<ScheduledTask>) =>
    set((state: AppState) => ({
      tasks: state.tasks.map((t: ScheduledTask) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id: string) =>
    set((state: AppState) => ({ tasks: state.tasks.filter((t: ScheduledTask) => t.id !== id) })),

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
  setSettings: (updates: Partial<Settings>) =>
    set((state: AppState) => ({
      settings: { ...state.settings, ...updates },
    })),

  // Legacy provider (for backwards compatibility) - empty by default
  provider: '',
  setProvider: (provider) => set({ provider }),
  
  // Tool confirmation for high-risk output tools
  pendingConfirmation: null,
  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),

  // Toast notifications
  toasts: [],
  addToast: (toast: ToastMessage) =>
    set((state: AppState) => ({
      // Limit to 5 toasts max, remove oldest if needed
      toasts: [...state.toasts, toast].slice(-5),
    })),
  removeToast: (id: string) =>
    set((state: AppState) => ({
      toasts: state.toasts.filter((t: ToastMessage) => t.id !== id),
    })),
  clearAllToasts: () => set({ toasts: [] }),

  // Voice settings and state - load from localStorage
  voiceSettings: getInitialVoiceSettings(),
  setVoiceSettings: (updates: Partial<VoiceSettings>) =>
    set((state: AppState) => {
      const newSettings = { ...state.voiceSettings, ...updates };
      saveVoiceSettings(newSettings);
      return { voiceSettings: newSettings };
    }),
  voiceServiceAvailable: false,
  setVoiceServiceAvailable: (available) => set({ voiceServiceAvailable: available }),
  wakeWordStatus: 'disabled',
  setWakeWordStatus: (status) => set({ wakeWordStatus: status }),
  isTtsSpeaking: false,
  setIsTtsSpeaking: (speaking) => set({ isTtsSpeaking: speaking }),
}));
