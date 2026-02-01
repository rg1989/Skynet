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

interface Authorization {
  id: string;
  toolName: string;
  scope: 'exact' | 'pattern' | 'tool';
  pattern: string;
  description: string;
  createdAt: number;
}

// localStorage key for saving enabled tools before switching to Ollama
const STORAGE_KEY_SAVED_TOOLS = 'skynet_saved_enabled_tools';

// Tool risk classifications for display
const HIGH_OUTPUT_TOOLS = ['gmail_send', 'exec', 'write_file', 'edit_file'];
const HIGH_INPUT_TOOLS = ['gmail_read', 'web_fetch', 'web_search', 'read_file'];

function getToolRiskLevel(toolName: string): 'high-output' | 'high-input' | 'low' {
  if (HIGH_OUTPUT_TOOLS.includes(toolName)) return 'high-output';
  if (HIGH_INPUT_TOOLS.includes(toolName)) return 'high-input';
  return 'low';
}

function getToolRiskBadge(toolName: string) {
  const risk = getToolRiskLevel(toolName);
  if (risk === 'high-output') {
    return {
      label: 'Requires Approval',
      className: 'bg-red-600/20 text-red-400 border-red-600/30',
      title: 'This tool performs actions that can modify files, send data, or execute commands. Requires your approval each time unless you save an authorization.',
    };
  }
  if (risk === 'high-input') {
    return {
      label: 'External Data',
      className: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
      title: 'This tool fetches data from external sources. Content is marked as untrusted to prevent prompt injection.',
    };
  }
  return null;
}

type SettingsTab = 'providers' | 'tools' | 'general' | 'assistant';

// Collapsible section component
function CollapsibleSection({ 
  title, 
  icon, 
  iconColor = 'text-slate-400',
  children, 
  defaultOpen = false,
  badge,
}: { 
  title: string; 
  icon: React.ReactNode;
  iconColor?: string;
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <h3 className={`font-medium flex items-center gap-2 ${iconColor}`}>
          {icon}
          <span className="text-white">{title}</span>
          {badge}
        </h3>
        <svg 
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-700/50">
          {children}
        </div>
      )}
    </section>
  );
}

export function Settings() {
  const { settings, setSettings, voiceSettings, setVoiceSettings, voiceServiceAvailable, setVoiceServiceAvailable } = useStore();
  const { showToast } = useToast();
  
  // Get active tab from URL params, default to 'providers'
  const { tab } = useParams<{ tab: string }>();
  const activeTab: SettingsTab = (
    tab === 'tools' ? 'tools' : 
    tab === 'general' ? 'general' : 
    tab === 'assistant' ? 'assistant' : 
    'providers'
  );
  
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
  
  // Reset assistant modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Voice settings state
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [availableWakeWordModels, setAvailableWakeWordModels] = useState<WakeWordModel[]>([]);

  // Authorization state
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loadingAuths, setLoadingAuths] = useState(false);

  // Fetch all settings on mount
  useEffect(() => {
    fetchProviders();
    fetchTools();
    fetchSystemPrompt();
    fetchApiKeys();
    fetchVoiceStatus();
    fetchVoices();
    fetchWakeWordModels();
    fetchAuthorizations();
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
        toolsMode: data.mode || 'hybrid',
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
      // API returns masked keys (e.g., "sk-...abc123")
      if (data.openai) setOpenaiKey(data.openai);
      if (data.anthropic) setAnthropicKey(data.anthropic);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchVoiceStatus = async () => {
    try {
      const response = await fetch('/api/voice/status');
      const data = await response.json();
      setVoiceServiceAvailable(data.connected);
    } catch (error) {
      console.error('Failed to fetch voice status:', error);
      setVoiceServiceAvailable(false);
    }
  };

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/voice/voices');
      const data = await response.json();
      const voiceList = Object.entries(data.voices || {}).map(([id, name]) => ({ 
        id, 
        name: name as string 
      }));
      setAvailableVoices(voiceList);
    } catch (error) {
      console.error('Failed to fetch voices:', error);
    }
  };

  const fetchWakeWordModels = async () => {
    try {
      const response = await fetch('/api/voice/wakeword/models');
      const data = await response.json();
      const modelList = Object.entries(data.models || {}).map(([id, name]) => ({ 
        id, 
        name: name as string 
      }));
      setAvailableWakeWordModels(modelList);
    } catch (error) {
      console.error('Failed to fetch wake word models:', error);
    }
  };

  const fetchAuthorizations = async () => {
    setLoadingAuths(true);
    try {
      const response = await fetch('/api/authorizations');
      const data = await response.json();
      setAuthorizations(data.authorizations || []);
    } catch (error) {
      console.error('Failed to fetch authorizations:', error);
    } finally {
      setLoadingAuths(false);
    }
  };

  const handleRevokeAuthorization = async (authId: string) => {
    try {
      const response = await fetch(`/api/authorizations/${encodeURIComponent(authId)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setAuthorizations(prev => prev.filter(a => a.id !== authId));
        showToast('success', 'Authorization revoked');
      } else {
        showToast('error', 'Failed to revoke authorization');
      }
    } catch (error) {
      showToast('error', 'Failed to revoke authorization');
      console.error('Failed to revoke authorization:', error);
    }
  };

  const handleClearAllAuthorizations = async () => {
    try {
      const response = await fetch('/api/authorizations', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setAuthorizations([]);
        showToast('success', 'All authorizations cleared');
      } else {
        showToast('error', 'Failed to clear authorizations');
      }
    } catch (error) {
      showToast('error', 'Failed to clear authorizations');
      console.error('Failed to clear authorizations:', error);
    }
  };

  const handleProviderChange = async (provider: string) => {
    // If switching to Ollama, show the confirmation modal
    if (provider === 'ollama') {
      setShowOllamaModal(true);
      return;
    }
    
    await performProviderSwitch(provider);
  };

  const performProviderSwitch = async (provider: string, disableAllTools = false) => {
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
        await fetchModels(data.provider);
        showToast('success', `Switched to ${provider}`);
        
        // If switching to Ollama, disable all tools except meta tools
        if (disableAllTools) {
          await disableAllToolsExceptMeta();
        } else if (provider !== 'ollama') {
          // When switching away from Ollama, restore saved tools
          await restoreSavedTools();
        }
      }
    } catch (error) {
      showToast('error', 'Failed to switch provider');
    }
  };

  const handleOllamaConfirm = async () => {
    setShowOllamaModal(false);
    await performProviderSwitch('ollama', true);
  };

  const handleOllamaCancel = () => {
    setShowOllamaModal(false);
  };

  // Save current enabled tools to localStorage (before switching to Ollama)
  const saveEnabledTools = () => {
    const enabledTools = settings.tools
      .filter(t => t.enabled)
      .map(t => t.name);
    localStorage.setItem(STORAGE_KEY_SAVED_TOOLS, JSON.stringify(enabledTools));
  };

  // Disable all tools except the meta/self-config tools
  const disableAllToolsExceptMeta = async () => {
    // First save current enabled tools
    saveEnabledTools();
    
    try {
      const response = await fetch('/api/tools/disable-all-except-meta', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchTools(); // Refresh tools list
        showToast('success', 'Tools disabled for Ollama (except meta tools)');
      }
    } catch (error) {
      showToast('error', 'Failed to disable tools');
    }
  };

  // Restore previously saved tools from localStorage
  const restoreSavedTools = async () => {
    const savedToolsJson = localStorage.getItem(STORAGE_KEY_SAVED_TOOLS);
    if (!savedToolsJson) return;
    
    try {
      const savedTools = JSON.parse(savedToolsJson) as string[];
      if (savedTools.length === 0) return;
      
      const response = await fetch('/api/tools/enable-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: savedTools }),
      });
      
      if (response.ok) {
        await fetchTools(); // Refresh tools list
        showToast('success', 'Restored your previous tool selection');
        localStorage.removeItem(STORAGE_KEY_SAVED_TOOLS); // Clean up
      }
    } catch (error) {
      console.error('Failed to restore tools:', error);
    }
  };

  const handleModelChange = async (model: string) => {
    try {
      // Find the full model info to check size
      const modelInfo = settings.availableModels.find(m => m.name === model);
      
      const response = await fetch('/api/config/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: settings.currentProvider,
          model,
        }),
      });
      
      if (response.ok) {
        setSettings({ currentModel: model });
        
        // Show size info if available
        if (modelInfo?.size) {
          showToast('success', `Switched to ${model} (${formatBytes(modelInfo.size)})`);
        } else {
          showToast('success', `Switched to ${model}`);
        }
      }
    } catch (error) {
      showToast('error', 'Failed to switch model');
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
      showToast('error', 'Failed to toggle tool');
    }
  };

  const handleToggleAllTools = async (enableAll: boolean) => {
    try {
      const endpoint = enableAll ? '/api/tools/enable-all' : '/api/tools/disable-all';
      const response = await fetch(endpoint, { method: 'POST' });
      
      if (response.ok) {
        setSettings({
          tools: settings.tools.map(t => ({ ...t, enabled: enableAll })),
        });
        showToast('success', enableAll ? 'All tools enabled' : 'All tools disabled');
      }
    } catch (error) {
      showToast('error', 'Failed to toggle tools');
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
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
      const response = await fetch('/api/system-prompt', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.prompt);
        setSettings({ systemPrompt: data.prompt, isDefaultPrompt: true });
        setPromptDirty(false);
        showToast('success', 'Prompt reset to default');
      }
    } catch (error) {
      showToast('error', 'Failed to reset prompt');
    }
  };

  const handleSaveApiKeys = async () => {
    setSavingKeys(true);
    try {
      const response = await fetch('/api/config/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          openai: openaiKey.startsWith('sk-...') ? undefined : openaiKey,
          anthropic: anthropicKey.startsWith('sk-ant-...') ? undefined : anthropicKey,
        }),
      });
      
      if (response.ok) {
        setKeysDirty(false);
        showToast('success', 'API keys saved');
        // Refresh providers to update availability
        await fetchProviders();
      }
    } catch (error) {
      showToast('error', 'Failed to save API keys');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleWarmup = useCallback(async () => {
    try {
      setSettings({ warmingUp: true });
      showToast('success', 'Warming up model...');
      
      const response = await fetch('/api/warmup', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        showToast('success', `Model ready! (${data.durationMs}ms)`);
      } else {
        showToast('error', data.error || 'Warmup failed');
      }
    } catch (error) {
      showToast('error', 'Warmup request failed');
    } finally {
      setSettings({ warmingUp: false });
    }
  }, [setSettings]);

  // Handle reset assistant - clears all onboarding data
  const handleResetAssistant = async () => {
    setResetting(true);
    try {
      const response = await fetch('/api/onboarding/reset', { method: 'DELETE' });
      if (response.ok) {
        showToast('success', 'Assistant reset. Reloading...');
        // Reload the page to trigger onboarding
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        const data = await response.json();
        showToast('error', data.error || 'Failed to reset assistant');
      }
    } catch (error) {
      showToast('error', 'Failed to reset assistant');
      console.error('Reset error:', error);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  };

  const handleVoiceSettingChange = (updates: Partial<typeof voiceSettings>) => {
    setVoiceSettings(updates);
  };

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
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'providers'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Providers</span>
        </Link>
        <Link
          to="/settings/tools"
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'tools'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Tools & Rules</span>
        </Link>
        <Link
          to="/settings/general"
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'general'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="hidden sm:inline">General</span>
        </Link>
        <Link
          to="/settings/assistant"
          className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'assistant'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="hidden sm:inline">Assistant</span>
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

        {/* TOOLS & RULES TAB */}
        {activeTab === 'tools' && (
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
                <>
                  {/* Enable All Toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg mb-3 border border-slate-700/50">
                    <div>
                      <div className="font-medium text-sm">Enable All Tools</div>
                      <div className="text-xs text-slate-500">Toggle all tools on or off at once</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.tools.length > 0 && settings.tools.every(t => t.enabled)}
                        onChange={(e) => handleToggleAllTools(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto space-y-2">
                  {settings.tools.map((tool) => {
                    const riskBadge = getToolRiskBadge(tool.name);
                    return (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg group relative"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{tool.name}</span>
                            {riskBadge && (
                              <span 
                                className={`text-xs px-1.5 py-0.5 rounded border ${riskBadge.className}`}
                                title={riskBadge.title}
                              >
                                {riskBadge.label}
                              </span>
                            )}
                          </div>
                          {/* Full description with tooltip on hover */}
                          <div 
                            className="text-xs text-slate-500 mt-1 cursor-help"
                            title={tool.description}
                          >
                            <span className="line-clamp-2">{tool.description}</span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={tool.enabled}
                            onChange={(e) => handleToolToggle(tool.name, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    );
                  })}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <>
            {/* Model Warmup Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Model Warmup
              </h3>
              
              <p className="text-sm text-slate-400 mb-4">
                Pre-load the current model into memory for faster response times on the first message.
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleWarmup}
                  disabled={settings.warmingUp}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
                
                <div className="text-sm text-slate-500">
                  Current: <span className="text-slate-300">{settings.currentProvider}</span> / <span className="text-slate-300">{settings.currentModel || 'default'}</span>
                </div>
              </div>
            </section>

            {/* App Info Section */}
            <section className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                About
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Application</span>
                  <span className="text-slate-300">Skynet Lite</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Voice Service</span>
                  <span className={voiceServiceAvailable ? 'text-emerald-400' : 'text-slate-500'}>
                    {voiceServiceAvailable ? 'Connected' : 'Not Available'}
                  </span>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ASSISTANT TAB */}
        {activeTab === 'assistant' && (
          <div className="space-y-4">
            {/* Voice Section - Collapsed by default */}
            <CollapsibleSection
              title="Voice"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              }
              iconColor="text-violet-400"
              defaultOpen={false}
              badge={
                voiceServiceAvailable ? (
                  <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded ml-2">Connected</span>
                ) : (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded ml-2">Not Available</span>
                )
              }
            >
              <div className="pt-4 space-y-6">
                {/* Voice Service Warning */}
                {!voiceServiceAvailable && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-amber-400 font-medium text-sm">Voice Service Not Available</p>
                        <p className="text-xs text-slate-400 mt-1">
                          To enable TTS and wake word features, set up the voice service:
                        </p>
                        <code className="block text-xs text-slate-500 mt-2 bg-slate-900 p-2 rounded font-mono">
                          cd voice && python3 -m venv venv && source venv/bin/activate && pip install -e .
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* TTS Settings */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.586a2 2 0 001.414.586h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 001.414 0l.586-.586a1 1 0 00.293-.707V6a1 1 0 00-.293-.707l-.586-.586a1 1 0 00-1.414 0L9.293 7.121A1 1 0 018.586 7.414H7a2 2 0 00-2 2v4.172a2 2 0 00.586 1.414z" />
                    </svg>
                    Text-to-Speech
                  </h4>
                  
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
                </div>

                {/* Wake Word Settings */}
                <div className="pt-4 border-t border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Wake Word Detection
                  </h4>

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
                </div>
              </div>
            </CollapsibleSection>

            {/* Agent Section - Collapsed by default */}
            <CollapsibleSection
              title="Agent"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              iconColor="text-emerald-400"
              defaultOpen={false}
              badge={
                authorizations.length > 0 ? (
                  <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded ml-2">
                    {authorizations.length} saved
                  </span>
                ) : null
              }
            >
              <div className="pt-4 space-y-6">
                {/* Saved Authorizations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Saved Authorizations
                    </h4>
                    {authorizations.length > 0 && (
                      <button
                        onClick={handleClearAllAuthorizations}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-3">
                    Actions you've allowed the agent to perform without asking for confirmation each time.
                  </p>

                  {loadingAuths ? (
                    <div className="text-sm text-slate-400 p-4 bg-slate-900/50 rounded-lg text-center">
                      Loading...
                    </div>
                  ) : authorizations.length === 0 ? (
                    <div className="text-sm text-slate-500 p-4 bg-slate-900/50 rounded-lg text-center">
                      No saved authorizations yet. When you allow an action with "Remember", it will appear here.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {authorizations.map((auth) => (
                        <div
                          key={auth.id}
                          className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-white">{auth.toolName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                auth.scope === 'tool' ? 'bg-violet-600/30 text-violet-400' :
                                auth.scope === 'pattern' ? 'bg-amber-600/30 text-amber-400' :
                                'bg-slate-600/30 text-slate-400'
                              }`}>
                                {auth.scope === 'tool' ? 'All' : auth.scope === 'pattern' ? 'Pattern' : 'Exact'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 truncate mt-1" title={auth.description}>
                              {auth.description}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              Added {new Date(auth.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeAuthorization(auth.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 ml-2"
                            title="Revoke authorization"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Danger Zone */}
                <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Danger Zone
                  </h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">Reset Assistant</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Clear all personalization and start the setup process again.
                        This will forget your name, preferences, and custom personality.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowResetModal(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ml-4"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>
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

      {/* Reset Assistant Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset Assistant?"
        message="This will clear all personalization including your name, the assistant's name, personality settings, and custom system prompt. The assistant will ask you to set everything up again."
        confirmLabel={resetting ? 'Resetting...' : 'Reset Everything'}
        cancelLabel="Cancel"
        onConfirm={handleResetAssistant}
        onCancel={() => setShowResetModal(false)}
        danger
      />
    </div>
  );
}
