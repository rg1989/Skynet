import { useState, useCallback } from 'react';
import { useStore, type SessionInfo } from '../store';
import { ConfirmModal } from './ConfirmModal';

interface SessionSidebarProps {
  onSessionChange: (key: string) => void;
}

export function SessionSidebar({ onSessionChange }: SessionSidebarProps) {
  const { sessions, setSessions, currentSessionKey, setCurrentSession, removeSession } = useStore();
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sessions are fetched by Chat component on mount, no need to duplicate here

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
    // Use the key as a fallback title, but format it nicely
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

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <div className="text-center text-slate-500 text-xs mt-4 px-2">
              No previous chats
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.key}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    session.key === currentSessionKey
                      ? 'bg-emerald-600/20 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => handleSelectSession(session.key)}
                >
                  {/* Chat icon */}
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{getSessionTitle(session)}</div>
                    <div className="text-xs text-slate-500">
                      {session.messageCount} messages
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
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
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
