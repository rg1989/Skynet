import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Chat } from './components/Chat';
import { TaskList } from './components/TaskList';
import { WorkflowManager } from './components/WorkflowManager';
import { CronManager } from './components/CronManager';
import { Settings } from './components/Settings';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';

// Icons
function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function WorkflowsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Page wrapper for consistent layout
function PageWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="h-14 shrink-0 border-b border-slate-700/50 flex items-center px-6 bg-[#1e2227]">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}

// Main layout with sidebar
function Layout() {
  const { connected } = useStore();
  const location = useLocation();
  
  // Initialize WebSocket connection
  useWebSocket();

  const tabs = [
    { path: '/', label: 'Chat', icon: <ChatIcon /> },
    { path: '/tasks', label: 'Tasks', icon: <TasksIcon /> },
    { path: '/workflows', label: 'Workflows', icon: <WorkflowsIcon /> },
    { path: '/cron', label: 'Schedule', icon: <ScheduleIcon /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  // Check if current path matches (for settings, match any /settings/* path)
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#15181c] text-white">
      {/* Sidebar */}
      <aside className="w-16 bg-[#1e2227] border-r border-slate-700/50 flex flex-col items-center py-4">
        {/* Logo */}
        <NavLink 
          to="/"
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="5" y="8" width="14" height="10" rx="2" strokeWidth={1.5} />
            <line x1="12" y1="8" x2="12" y2="5" strokeWidth={1.5} strokeLinecap="round" />
            <circle cx="12" cy="4" r="1" fill="currentColor" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <line x1="9" y1="15" x2="15" y2="15" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </NavLink>
        
        {/* Nav tabs */}
        <nav className="flex-1 flex flex-col gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                isActive(tab.path)
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </NavLink>
          ))}
        </nav>
        
        {/* Connection status */}
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-red-500 animate-pulse'
          }`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/tasks" element={<PageWrapper title="Tasks"><TaskList /></PageWrapper>} />
          <Route path="/workflows" element={<PageWrapper title="Workflows"><WorkflowManager /></PageWrapper>} />
          <Route path="/cron" element={<PageWrapper title="Scheduled Tasks"><CronManager /></PageWrapper>} />
          {/* Settings routes - redirect /settings to /settings/providers */}
          <Route path="/settings" element={<Navigate to="/settings/providers" replace />} />
          <Route path="/settings/:tab" element={<PageWrapper title="Settings"><Settings /></PageWrapper>} />
          {/* Catch-all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
