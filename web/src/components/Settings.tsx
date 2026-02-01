import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore, type ToolsMode } from '../store';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './Toast';

interface ProviderInfo {
  name: string;
  model: string;
  isDefault: boolean;
  isAvailable: boolean;
}

interface VoiceInfo {
  id: string;
  name: string;
}

interface WakeWordModel {
  id: string;
  name: string;
}

// localStorage key for saving enabled tools before switching to Ollama
const STORAGE_KEY_SAVED_TOOLS = 'skynet_saved_enabled_tools';

type SettingsTab = 'providers' | 'system' | 'voice';

export function Settings() {
  const { settings, setSettings, voiceSettings, setVoiceSettings, voiceServiceAvailable, setVoiceServiceAvailable } = useStore();
  const { showToast } = useToast();
  
  // Get active tab from URL params, default to 'providers'
  const { tab } = useParams<{ tab: string }>();
  const activeTab: SettingsTab = (tab === 'system' ? 'system' : tab === 'voice' ? 'voice' : 'providers');
  
  // Local state for editable fields
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptDirty, setPromptDirty] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  
  // API Keys state
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysDirty, setKeysDirty] = useState(false);
  
  // Ollama switch modal state
  const [showOllamaModal, setShowOllamaModal] = useState(false);

  // Voice settings state
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [availableWakeWordModels, setAvailableWakeWordModels] = useState<WakeWordModel[]>([]);

  // Fetch all settings on mount
  useEffect(() => {
    fetchProviders();
    fetchTools();
    fetchSystemPrompt();
    fetchApiKeys();
    fetchVoiceStatus();
    fetchVoices();
    fetchWakeWordModels();
  }, []);

  // Use showToast from the Toast component for notifications

  const fetchProviders = async () => {
    try {
      setSettings({ loading: true });
      const response = await fetch('/api/providers');
      const data = await response.json();
      
      setSettings({
        providers: data.providers,
        currentProvider: data.currentProvider,
        currentModel: data.providers.find((p: ProviderInfo) => p.isDefault)?.model || '',
      });

      // Fetch models for current provider
      if (data.currentProvider) {
        await fetchModels(data.currentProvider);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setSettings({ loading: false });
    }
  };

  const fetchModels = async (provider: string) => {
    try {
      const response = await fetch(`/api/providers/${provider}/models`);
      const data = await response.json();
      setSettings({ availableModels: data.models || [] });
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setSettings({ availableModels: [] });
    }
  };

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/tools');
      const data = await response.json();
      setSettings({
        tools: data.tools || [],
        toolsMode: data.toolsMode || 'hybrid',
      });
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  };

  const fetchSystemPrompt = async () => {
    try {
      const response = await fetch('/api/system-prompt');
      const data = await response.json();
      setSystemPrompt(data.prompt || '');
      setSettings({
        systemPrompt: data.prompt || '',
        isDefaultPrompt: data.isDefault,
      });
    } catch (error) {
      console.error('Failed to fetch system prompt:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/config/api-keys');
      const data = await response.json();
      // Keys are masked on the server side, so we just show placeholders if configured
      setOpenaiKey(data.openai?.configured ? '••••••••••••••••' : '');
      setAnthropicKey(data.anthropic?.configured ? '••••••••••••••••' : '');
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchVoiceStatus = async () => {
    try {
      const response = await fetch('/api/voice/status');
      const data = await response.json();
      setVoiceServiceAvailable(data.available && data.running);
    } catch (error) {
      console.error('Failed to fetch voice status:', error);
      setVoiceServiceAvailable(false);
    }
  };

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/voice/voices');
      const data = await response.json();
      if (data.voices) {
        const voices = Object.entries(data.voices).map(([id, name]) => ({
          id,
          name: name as string,
        }));
        setAvailableVoices(voices);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
  };

  const fetchWakeWordModels = async () => {
    try {
      const response = await fetch('/api/voice/wakeword/models');
      const data = await response.json();
      if (data.models) {
        const models = Object.entries(data.models).map(([id, name]) => ({
          id,
          name: name as string,
        }));
        setAvailableWakeWordModels(models);
      }
    } catch (error) {
      console.error('Failed to fetch wake word models:', error);
    }
  };

  const handleVoiceSettingChange = async (updates: Partial<typeof voiceSettings>) => {
    setVoiceSettings(updates);
    
    try {
      await fetch('/api/voice/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tts: {
            enabled: updates.ttsEnabled ?? voiceSettings.ttsEnabled,
            muted: updates.ttsMuted ?? voiceSettings.ttsMuted,
            voice: updates.ttsVoice ?? voiceSettings.ttsVoice,
            speed: updates.ttsSpeed ?? voiceSettings.ttsSpeed,
          },
          wakeword: {
            enabled: updates.wakeWordEnabled ?? voiceSettings.wakeWordEnabled,
            model: updates.wakeWordModel ?? voiceSettings.wakeWordModel,
            threshold: updates.wakeWordThreshold ?? voiceSettings.wakeWordThreshold,
            timeoutSeconds: updates.wakeWordTimeoutSeconds ?? voiceSettings.wakeWordTimeoutSeconds,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to update voice settings:', error);
    }
  };

  const testProviderConnection = async (provider: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`/api/config/test-connection/${provider}`, {
        method: 'POST',
      });
      const data = await response.json();
      return {
        success: data.success,
        message: data.success ? data.message : (data.error || 'Connection failed'),
      };
    } catch {
      return { success: false, message: `Failed to test ${provider} connection` };
    }
  };

  const handleSaveApiKeys = async () => {
    try {
      setSavingKeys(true);
      
      const keys: { openai?: string; anthropic?: string } = {};
      
      // Only send keys that have been changed (not placeholders)
      if (openaiKey && !openaiKey.startsWith('••')) {
        keys.openai = openaiKey;
      }
      if (anthropicKey && !anthropicKey.startsWith('••')) {
        keys.anthropic = anthropicKey;
      }
      
      if (Object.keys(keys).length === 0) {
        showToast('error', 'No keys to save');
        return;
      }
      
      const response = await fetch('/api/config/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      
      if (response.ok) {
        showToast('success', 'API keys saved. Testing connections...');
        setKeysDirty(false);
        
        // Refresh providers to update availability
        await fetchProviders();
        // Update placeholders
        await fetchApiKeys();
        
        // Test connections for newly added keys
        const testResults: string[] = [];
        
        if (keys.anthropic) {
          const result = await testProviderConnection('anthropic');
          testResults.push(result.success 
            ? '✓ Anthropic connected' 
            : `✗ Anthropic: ${result.message}`);
        }
        
        if (keys.openai) {
          const result = await testProviderConnection('openai');
          testResults.push(result.success 
            ? '✓ OpenAI connected' 
            : `✗ OpenAI: ${result.message}`);
        }
        
        // Show combined result
        if (testResults.length > 0) {
          const allSuccess = testResults.every(r => r.startsWith('✓'));
          showToast(allSuccess ? 'success' : 'error', testResults.join(' | '));
        }
      } else {
        const data = await response.json();
        showToast('error', data.error || 'Failed to save API keys');
      }
    } catch (error) {
      showToast('error', 'Failed to save API keys');
    } finally {
      setSavingKeys(false);
    }
  };

  // Save current enabled tools to localStorage (before switching to Ollama)
  const saveEnabledTools = () => {
    const enabledTools = settings.tools
      .filter(t => t.enabled)
      .map(t => t.name);
    localStorage.setItem(STORAGE_KEY_SAVED_TOOLS, JSON.stringify(enabledTools));
  };

  // Restore saved tools from localStorage (when switching back from Ollama)
  const restoreSavedTools = async () => {
    const saved = localStorage.getItem(STORAGE_KEY_SAVED_TOOLS);
    let toolsToEnable: string[];
    
    if (saved) {
      toolsToEnable = JSON.parse(saved);
    } else {
      // No saved state = enable all tools (default behavior)
      toolsToEnable = settings.tools.map(t => t.name);
    }
    
    await fetch('/api/tools/enable-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: toolsToEnable }),
    });
  };

  // Perform the actual provider switch
  const doProviderSwitch = async (provider: string) => {
    try {
      const response = await fetch('/api/config/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings({
          currentProvider: data.provider,
          currentModel: data.model,
        });
        await fetchModels(provider);
        return true;
      }
      return false;
    } catch (error) {
      showToast('error', 'Failed to change provider');
      return false;
    }
  };

  const handleProviderChange = async (provider: string) => {
    // If switching TO Ollama from a cloud provider, show confirmation modal
    if (provider === 'ollama' && settings.currentProvider !== 'ollama') {
      setShowOllamaModal(true);
      return;
    }
    
    // If switching FROM Ollama to a cloud provider, restore saved tools
    if (settings.currentProvider === 'ollama' && provider !== 'ollama') {
      await restoreSavedTools();
      await doProviderSwitch(provider);
      await fetchTools();
      showToast('success', `Switched to ${provider}. Tools restored.`);
      return;
    }
    
    // Normal switch (e.g., between cloud providers or already on Ollama)
    if (await doProviderSwitch(provider)) {
      showToast('success', `Switched to ${provider}`);
    }
  };

  // Handle confirmation to switch to Ollama
  const handleOllamaConfirm = async () => {
    // Save current enabled tools before switching
    saveEnabledTools();
    
    // Disable all tools except meta-tools
    await fetch('/api/tools/disable-all-except-meta', { method: 'POST' });
    
    // Switch to Ollama
    await doProviderSwitch('ollama');
    
    // Refresh tools list to show updated enabled states
    await fetchTools();
    
    setShowOllamaModal(false);
    showToast('success', 'Switched to Ollama. Meta-tools enabled for self-management.');
  };

  const handleOllamaCancel = () => {
    setShowOllamaModal(false);
  };

  const handleModelChange = async (model: string) => {
    try {
      const response = await fetch('/api/config/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings({ currentModel: data.model });
        showToast('success', `Model changed to ${model}`);
      }
    } catch (error) {
      showToast('error', 'Failed to change model');
    }
  };

  const handleToolsModeChange = async (mode: ToolsMode) => {
    try {
      const response = await fetch('/api/config/tools-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      
      if (response.ok) {
        setSettings({ toolsMode: mode });
        showToast('success', `Tools mode: ${mode}`);
      }
    } catch (error) {
      showToast('error', 'Failed to change tools mode');
    }
  };

  const handleToolToggle = async (toolName: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/tools/${toolName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      
      if (response.ok) {
        setSettings({
          tools: settings.tools.map(t =>
            t.name === toolName ? { ...t, enabled } : t
          ),
        });
      }
    } catch (error) {
      showToast('error', `Failed to toggle ${toolName}`);
    }
  };

  const handleSavePrompt = async () => {
    try {
      setSavingPrompt(true);
      const response = await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt }),
      });
      
      if (response.ok) {
        setSettings({ systemPrompt, isDefaultPrompt: false });
        setPromptDirty(false);
        showToast('success', 'System prompt saved');
      }
    } catch (error) {
      showToast('error', 'Failed to save prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleResetPrompt = async () => {
    try {
      const response = await fetch('/api/system-prompt', { method: 'DELETE' });
      
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.prompt || '');
        setSettings({ systemPrompt: data.prompt || '', isDefaultPrompt: true });
        setPromptDirty(false);
        showToast('success', 'Reset to default prompt');
      }
    } catch (error) {
      showToast('error', 'Failed to reset prompt');
    }
  };

  const handleWarmup = useCallback(async () => {
    try {
      setSettings({ warmingUp: true });
      showToast('success', 'Warming up model...');
      
      const response = await fetch('/api/warmup', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        showToast('success', `Model warmed up in ${data.durationMs}ms`);
      } else {
        showToast('error', data.error || 'Warmup failed');
      }
    } catch (error) {
      showToast('error', 'Failed to warmup model');
    } finally {
      setSettings({ warmingUp: false });
    }
  }, [setSettings]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
        <Link
          to="/settings/providers"
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'providers'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Providers
        </Link>
        <Link
          to="/settings/system"
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'system'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          System Prompt & Tools
        </Link>
        <Link
          to="/settings/voice"
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'voice'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice
        </Link>
      </div>

      <div className="space-y-6">
        {/* PROVIDERS TAB */}
        {activeTab === 'providers' && (
          <>
            {/* Provider & Model Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Provider & Model
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider selector */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Provider</label>
                  <select
                    value={settings.currentProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {settings.providers.map((p) => (
                      <option key={p.name} value={p.name} disabled={!p.isAvailable}>
                        {p.name} {!p.isAvailable && '(unavailable)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model selector */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Model</label>
                  <select
                    value={settings.currentModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {settings.availableModels.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} {m.size ? `(${formatBytes(m.size)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warmup button */}
              <div className="mt-4">
                <button
                  onClick={handleWarmup}
                  disabled={settings.warmingUp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {settings.warmingUp ? (
                    <>
                      <span className="animate-spin">⚙️</span>
                      Warming up...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Warmup Model
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  Pre-loads the model into memory for faster responses
                </p>
              </div>
            </section>

            {/* API Keys Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                API Keys
              </h3>
              
              <p className="text-sm text-slate-400 mb-4">
                Configure API keys to use OpenAI or Anthropic providers. Keys are stored securely and never exposed.
              </p>

              <div className="space-y-4">
                {/* OpenAI API Key */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">OpenAI API Key</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => {
                      setOpenaiKey(e.target.value);
                      setKeysDirty(true);
                    }}
                    placeholder="sk-..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:underline">platform.openai.com</a>
                  </p>
                </div>

                {/* Anthropic API Key */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Anthropic API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => {
                      setAnthropicKey(e.target.value);
                      setKeysDirty(true);
                    }}
                    placeholder="sk-ant-..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:underline">console.anthropic.com</a>
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleSaveApiKeys}
                  disabled={!keysDirty || savingKeys}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {savingKeys ? 'Saving...' : 'Save API Keys'}
                </button>
              </div>
            </section>
          </>
        )}

        {/* SYSTEM PROMPT & TOOLS TAB */}
        {activeTab === 'system' && (
          <>
            {/* System Prompt Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                System Prompt / Rules
                {!settings.isDefaultPrompt && (
                  <span className="text-xs bg-violet-600 px-2 py-0.5 rounded">Custom</span>
                )}
              </h3>

              <textarea
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  setPromptDirty(e.target.value !== settings.systemPrompt);
                }}
                placeholder="Enter custom instructions for the AI..."
                rows={8}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none font-mono"
              />

              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleSavePrompt}
                  disabled={!promptDirty || savingPrompt}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  {savingPrompt ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleResetPrompt}
                  disabled={settings.isDefaultPrompt}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </section>

            {/* Tools Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Tools ({settings.tools.filter(t => t.enabled).length}/{settings.tools.length} enabled)
              </h3>

              {/* Tools mode selector */}
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Tools Mode</label>
                <div className="flex flex-wrap gap-2">
                  {(['hybrid', 'native', 'text', 'disabled'] as ToolsMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleToolsModeChange(mode)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.toolsMode === mode
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {settings.toolsMode === 'hybrid' && 'Try native API first, fall back to text parsing'}
                  {settings.toolsMode === 'native' && 'Only use native API tool calls'}
                  {settings.toolsMode === 'text' && 'Use text-based tool call parsing'}
                  {settings.toolsMode === 'disabled' && 'No tools, simple chat mode'}
                </p>
              </div>

              {/* Tools list */}
              {settings.toolsMode !== 'disabled' && (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {settings.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{tool.name}</div>
                        <div className="text-xs text-slate-500 truncate">{tool.description}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={tool.enabled}
                          onChange={(e) => handleToolToggle(tool.name, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* VOICE TAB */}
        {activeTab === 'voice' && (
          <>
            {/* Voice Service Status */}
            {!voiceServiceAvailable && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-amber-400 font-medium">Voice Service Not Available</p>
                    <p className="text-sm text-slate-400 mt-1">
                      To enable TTS and wake word features, set up the voice service:
                    </p>
                    <code className="block text-xs text-slate-500 mt-2 bg-slate-900 p-2 rounded font-mono">
                      cd voice && python3 -m venv venv && source venv/bin/activate && pip install -e .
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* TTS Settings Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.586a2 2 0 001.414.586h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 001.414 0l.586-.586a1 1 0 00.293-.707V6a1 1 0 00-.293-.707l-.586-.586a1 1 0 00-1.414 0L9.293 7.121A1 1 0 018.586 7.414H7a2 2 0 00-2 2v4.172a2 2 0 00.586 1.414z" />
                </svg>
                Text-to-Speech (TTS)
              </h3>

              {/* TTS Enable Toggle */}
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">Enable TTS</div>
                  <div className="text-xs text-slate-500">Read AI responses aloud</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceSettings.ttsEnabled}
                    onChange={(e) => {
                      handleVoiceSettingChange({ ttsEnabled: e.target.checked });
                      showToast('success', e.target.checked ? 'TTS enabled' : 'TTS disabled');
                    }}
                    disabled={!voiceServiceAvailable}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Voice Selector */}
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Voice</label>
                <select
                  value={voiceSettings.ttsVoice}
                  onChange={(e) => {
                    handleVoiceSettingChange({ ttsVoice: e.target.value });
                    showToast('success', 'Voice changed');
                  }}
                  disabled={!voiceServiceAvailable || !voiceSettings.ttsEnabled}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed Slider */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Speed: {voiceSettings.ttsSpeed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={voiceSettings.ttsSpeed}
                  onChange={(e) => handleVoiceSettingChange({ ttsSpeed: parseFloat(e.target.value) })}
                  disabled={!voiceServiceAvailable || !voiceSettings.ttsEnabled}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
            </section>

            {/* Wake Word Settings Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 mt-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Wake Word Detection
              </h3>

              {/* Wake Word Enable Toggle */}
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">Enable Wake Word</div>
                  <div className="text-xs text-slate-500">Say the wake word to start listening</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceSettings.wakeWordEnabled}
                    onChange={(e) => {
                      handleVoiceSettingChange({ wakeWordEnabled: e.target.checked });
                      showToast('success', e.target.checked ? 'Wake word enabled' : 'Wake word disabled');
                    }}
                    disabled={!voiceServiceAvailable}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Wake Word Model Selector */}
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Wake Word</label>
                <select
                  value={voiceSettings.wakeWordModel}
                  onChange={(e) => {
                    handleVoiceSettingChange({ wakeWordModel: e.target.value });
                    showToast('success', 'Wake word changed');
                  }}
                  disabled={!voiceServiceAvailable || !voiceSettings.wakeWordEnabled}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  {availableWakeWordModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold Slider */}
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">
                  Sensitivity: {Math.round(voiceSettings.wakeWordThreshold * 100)}%
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="0.8"
                  step="0.05"
                  value={voiceSettings.wakeWordThreshold}
                  onChange={(e) => handleVoiceSettingChange({ wakeWordThreshold: parseFloat(e.target.value) })}
                  disabled={!voiceServiceAvailable || !voiceSettings.wakeWordEnabled}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Less sensitive</span>
                  <span>More sensitive</span>
                </div>
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Timeout: {voiceSettings.wakeWordTimeoutSeconds}s
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={voiceSettings.wakeWordTimeoutSeconds}
                  onChange={(e) => handleVoiceSettingChange({ wakeWordTimeoutSeconds: parseInt(e.target.value) })}
                  disabled={!voiceServiceAvailable || !voiceSettings.wakeWordEnabled}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>5s</span>
                  <span>30s</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  How long to stay active after wake word before returning to listening
                </p>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Ollama Switch Confirmation Modal */}
      <ConfirmModal
        isOpen={showOllamaModal}
        title="Switch to Ollama (Local Model)"
        message="For better performance with local models, all tools will be disabled except:

• list_tools - See available tools
• enable_tool - Enable tools on demand
• disable_tool - Disable tools when done

The model can ask for permission to enable specific tools when needed. Your current tool selection will be saved and restored when you switch back to a cloud provider."
        confirmLabel="Switch to Ollama"
        cancelLabel="Cancel"
        onConfirm={handleOllamaConfirm}
        onCancel={handleOllamaCancel}
      />
    </div>
  );
}
