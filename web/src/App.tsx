import { useState } from 'react';
import { Chat } from './components/Chat';
import { TaskList } from './components/TaskList';
import { CronManager } from './components/CronManager';
import { Settings } from './components/Settings';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';

type Tab = 'chat' | 'tasks' | 'cron' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const { connected } = useStore();
  
  // Initialize WebSocket connection
  useWebSocket();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'tasks', label: 'Tasks', icon: '⚡' },
    { id: 'cron', label: 'Schedule', icon: '⏰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-16 bg-gray-950 flex flex-col items-center py-4 border-r border-gray-800">
        {/* Logo */}
        <div className="text-2xl mb-6">🤖</div>
        
        {/* Nav tabs */}
        <nav className="flex-1 flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </nav>
        
        {/* Connection status */}
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-gray-800 flex items-center px-4 justify-between">
          <h1 className="text-lg font-semibold">
            Skynet {activeTab !== 'chat' && `- ${tabs.find(t => t.id === activeTab)?.label}`}
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'chat' && <Chat />}
          {activeTab === 'tasks' && <TaskList />}
          {activeTab === 'cron' && <CronManager />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;
