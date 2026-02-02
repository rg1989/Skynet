import { useState, useCallback, useMemo } from 'react';
import { useStore, type SessionInfo, type SessionSource } from '../store';
import { ConfirmModal } from './ConfirmModal';

interface SessionSidebarProps {
  onSessionChange: (key: string) => void;
}

// Source configuration for display
const SOURCE_CONFIG: Record<SessionSource, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  telegram: {
    label: 'Telegram',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    color: 'text-sky-400',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    ),
    color: 'text-green-400',
  },
  web: {
    label: 'Web',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    color: 'text-violet-400',
  },
  other: {
    label: 'Other',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: 'text-slate-400',
  },
};

// Order of source groups in sidebar
const SOURCE_ORDER: SessionSource[] = ['telegram', 'whatsapp', 'web', 'other'];

export function SessionSidebar({ onSessionChange }: SessionSidebarProps) {
  const { sessions, setSessions, currentSessionKey, setCurrentSession, removeSession } = useStore();
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SessionSource>>(new Set());

  // Group sessions by source
  const groupedSessions = useMemo(() => {
    const groups: Record<SessionSource, SessionInfo[]> = {
      telegram: [],
      whatsapp: [],
      web: [],
      other: [],
    };

    for (const session of sessions) {
      const source = session.source || 'other';
      groups[source].push(session);
    }

    return groups;
  }, [sessions]);

  const toggleGroup = (source: SessionSource) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const refreshSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const handleNewChat = useCallback(() => {
    const newKey = `chat-${Date.now()}`;
    setCurrentSession(newKey);
    onSessionChange(newKey);
  }, [setCurrentSession, onSessionChange]);

  const handleSelectSession = useCallback((key: string) => {
    if (key !== currentSessionKey) {
      setCurrentSession(key);
      onSessionChange(key);
    }
  }, [currentSessionKey, setCurrentSession, onSessionChange]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(`/api/sessions/${deleteTarget.key}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        removeSession(deleteTarget.key);
        
        // If we deleted the current session, create a new one
        if (deleteTarget.key === currentSessionKey) {
          handleNewChat();
        }
        
        // Refresh the sessions list
        await refreshSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getSessionTitle = (session: SessionInfo) => {
    // Use title from backend if available
    if (session.title) {
      return session.title;
    }
    // Fallback formatting
    const key = session.key;
    if (key.startsWith('chat-')) {
      return `Chat ${formatTime(session.createdAt)}`;
    }
    if (key === 'web-default') {
      return 'Default Chat';
    }
    return key;
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[#1a1d21] border-r border-slate-700/50 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          title="Expand sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <button
          onClick={handleNewChat}
          className="mt-4 w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors"
          title="New chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    );
  }

  const totalSessions = sessions.length;

  return (
    <>
      <div className="w-56 bg-[#1a1d21] border-r border-slate-700/50 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-slate-700/50 flex items-center justify-between px-3">
          <span className="text-sm font-medium text-slate-300">Chats</span>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Sessions list grouped by source */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {totalSessions === 0 ? (
            <div className="text-center text-slate-500 text-xs mt-4 px-2">
              No previous chats
            </div>
          ) : (
            <div className="space-y-2">
              {SOURCE_ORDER.map((source) => {
                const sessionsInGroup = groupedSessions[source];
                if (sessionsInGroup.length === 0) return null;

                const config = SOURCE_CONFIG[source];
                const isGroupCollapsed = collapsedGroups.has(source);

                return (
                  <div key={source} className="space-y-1">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(source)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded hover:bg-slate-800/50 transition-colors"
                    >
                      <span className={config.color}>{config.icon}</span>
                      <span className="text-slate-400 flex-1 text-left">{config.label}</span>
                      <span className="text-slate-500 text-xs">{sessionsInGroup.length}</span>
                      <svg 
                        className={`w-3 h-3 text-slate-500 transition-transform ${isGroupCollapsed ? '' : 'rotate-180'}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Sessions in group */}
                    {!isGroupCollapsed && (
                      <div className="space-y-0.5 ml-2">
                        {sessionsInGroup.map((session) => (
                          <div
                            key={session.key}
                            className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              session.key === currentSessionKey
                                ? 'bg-emerald-600/20 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                            onClick={() => handleSelectSession(session.key)}
                          >
                            {/* Session info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{getSessionTitle(session)}</div>
                              <div className="text-xs text-slate-500">
                                {session.messageCount} msgs · {formatTime(session.lastActivity)}
                              </div>
                            </div>

                            {/* Delete button (shown on hover) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(session);
                              }}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-all"
                              title="Delete chat"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Chat"
        message={`Are you sure you want to delete "${deleteTarget ? getSessionTitle(deleteTarget) : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
