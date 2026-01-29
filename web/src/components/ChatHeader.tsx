import { useEffect } from 'react';
import { useStore } from '../store';

interface ChatHeaderProps {
  isConnected: boolean;
  title?: string;
}

export function ChatHeader({ isConnected, title = 'Skynet' }: ChatHeaderProps) {
  const { settings, setSettings } = useStore();

  // Fetch current provider/model on mount
  useEffect(() => {
    const fetchProviderInfo = async () => {
      try {
        const response = await fetch('/api/providers');
        const data = await response.json();
        
        if (data.providers && data.currentProvider) {
          // Find the current provider info (not just the default one)
          const currentProviderInfo = data.providers.find(
            (p: { name: string; isDefault: boolean }) => p.name === data.currentProvider
          );
          
          setSettings({
            currentProvider: data.currentProvider,
            currentModel: currentProviderInfo?.model || '',
            providers: data.providers,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch provider info:', error);
        setSettings({ loading: false });
      }
    };

    fetchProviderInfo();
  }, [setSettings]);

  // Show loading state or actual provider info
  const modelDisplay = settings.loading
    ? 'Loading...'
    : settings.currentModel
      ? `${settings.currentProvider}/${settings.currentModel.split(':')[0]}`
      : settings.currentProvider || 'No provider';

  return (
    <header className="h-14 border-b border-slate-700/50 flex items-center px-6 justify-between bg-[#1e2227]">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {/* Model badge */}
        {settings.currentProvider && (
          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300 font-mono">
            {modelDisplay}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className={`flex items-center gap-2 text-sm ${
          isConnected ? 'text-emerald-400' : 'text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
          }`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
