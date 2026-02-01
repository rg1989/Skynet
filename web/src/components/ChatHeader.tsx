import { useEffect } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';

interface ChatHeaderProps {
  isConnected: boolean;
  title?: string;
}

// Speaker icons
function SpeakerOnIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

export function ChatHeader({ isConnected, title = 'Skynet' }: ChatHeaderProps) {
  const { settings, setSettings, voiceSettings, setVoiceSettings } = useStore();
  const { showToast } = useToast();

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

  // Toggle TTS mute
  const toggleTtsMuted = async () => {
    const newMuted = !voiceSettings.ttsMuted;
    setVoiceSettings({ ttsMuted: newMuted });
    showToast('success', newMuted ? 'Voice responses muted' : 'Voice responses unmuted');
    
    // Sync with backend
    try {
      await fetch('/api/voice/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tts: { muted: newMuted } }),
      });
    } catch (error) {
      console.error('Failed to sync TTS mute state:', error);
    }
  };

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
      
      <div className="flex items-center gap-4">
        {/* TTS Mute Button - only show when TTS is enabled */}
        {voiceSettings.ttsEnabled && (
          <button
            onClick={toggleTtsMuted}
            className={`p-2 rounded-lg transition-colors ${
              voiceSettings.ttsMuted
                ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
            }`}
            title={voiceSettings.ttsMuted ? 'Voice responses muted' : 'Voice responses enabled'}
          >
            {voiceSettings.ttsMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </button>
        )}
        
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
