import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: boolean;
  toolCalls?: { name: string; status: 'running' | 'done'; result?: string }[];
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

interface AppState {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // Active task
  activeRunId: string | null;
  setActiveRunId: (runId: string | null) => void;
  thinkingContent: string;
  setThinkingContent: (content: string) => void;
  appendThinkingContent: (delta: string) => void;

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
  provider: string;
  setProvider: (provider: string) => void;
}

export const useStore = create<AppState>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Messages
  messages: [],
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
  thinkingContent: '',
  setThinkingContent: (content) => set({ thinkingContent: content }),
  appendThinkingContent: (delta) =>
    set((state) => ({ thinkingContent: state.thinkingContent + delta })),

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

  // Settings
  provider: 'ollama',
  setProvider: (provider) => set({ provider }),
}));
