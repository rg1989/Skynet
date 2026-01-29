import { useState, useEffect, useCallback } from 'react';
import { useStore, type ToolsMode } from '../store';
import { ConfirmModal } from './ConfirmModal';

interface ProviderInfo {
  name: string;
  model: string;
  isDefault: boolean;
  isAvailable: boolean;
}

// localStorage key for saving enabled tools before switching to Ollama
const STORAGE_KEY_SAVED_TOOLS = 'skynet_saved_enabled_tools';

export function Settings() {
  const { settings, setSettings } = useStore();
  
  // Local state for editable fields
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptDirty, setPromptDirty] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // API Keys state
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysDirty, setKeysDirty] = useState(false);
  
  // Ollama switch modal state
  const [showOllamaModal, setShowOllamaModal] = useState(false);

  // Fetch all settings on mount
  useEffect(() => {
    fetchProviders();
    fetchTools();
    fetchSystemPrompt();
    fetchApiKeys();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

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
        showMessage('error', 'No keys to save');
        return;
      }
      
      const response = await fetch('/api/config/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      
      if (response.ok) {
        showMessage('success', 'API keys saved. Testing connections...');
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
          showMessage(allSuccess ? 'success' : 'error', testResults.join(' | '));
        }
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to save API keys');
      }
    } catch (error) {
      showMessage('error', 'Failed to save API keys');
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
      showMessage('error', 'Failed to change provider');
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
      showMessage('success', `Switched to ${provider}. Tools restored.`);
      return;
    }
    
    // Normal switch (e.g., between cloud providers or already on Ollama)
    if (await doProviderSwitch(provider)) {
      showMessage('success', `Switched to ${provider}`);
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
    showMessage('success', 'Switched to Ollama. Meta-tools enabled for self-management.');
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
        showMessage('success', `Model changed to ${model}`);
      }
    } catch (error) {
      showMessage('error', 'Failed to change model');
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
        showMessage('success', `Tools mode: ${mode}`);
      }
    } catch (error) {
      showMessage('error', 'Failed to change tools mode');
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
      showMessage('error', `Failed to toggle ${toolName}`);
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
        showMessage('success', 'System prompt saved');
      }
    } catch (error) {
      showMessage('error', 'Failed to save prompt');
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
        showMessage('success', 'Reset to default prompt');
      }
    } catch (error) {
      showMessage('error', 'Failed to reset prompt');
    }
  };

  const handleWarmup = useCallback(async () => {
    try {
      setSettings({ warmingUp: true });
      showMessage('success', 'Warming up model...');
      
      const response = await fetch('/api/warmup', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        showMessage('success', `Model warmed up in ${data.durationMs}ms`);
      } else {
        showMessage('error', data.error || 'Warmup failed');
      }
    } catch (error) {
      showMessage('error', 'Failed to warmup model');
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
      {/* Message toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        } text-white`}>
          {message.text}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      <div className="space-y-6">
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
            rows={6}
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

        {/* Keyboard Shortcuts */}
        <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Keyboard Shortcuts
          </h3>
          <div className="text-sm text-slate-400 space-y-2">
            <div className="flex items-center gap-3">
              <kbd className="bg-slate-700 px-2 py-1 rounded text-xs font-mono">Enter</kbd>
              <span>Send message</span>
            </div>
            <div className="flex items-center gap-3">
              <kbd className="bg-slate-700 px-2 py-1 rounded text-xs font-mono">Shift+Enter</kbd>
              <span>New line</span>
            </div>
          </div>
        </section>
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
