import { useState, useEffect } from 'react';

interface Config {
  server: { port: number; host: string };
  providers: { default: string; available: string[] };
  agent: { maxTokens: number; memory?: { enabled: boolean } };
}

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="text-red-400">Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Settings</h2>

      <div className="space-y-4">
        {/* Server info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium mb-2">Server</h3>
          <div className="text-sm text-gray-400">
            <div>Host: {config.server.host}</div>
            <div>Port: {config.server.port}</div>
          </div>
        </div>

        {/* Provider info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium mb-2">LLM Provider</h3>
          <div className="text-sm">
            <div className="text-gray-400">Current: <span className="text-green-400">{config.providers.default}</span></div>
            <div className="text-gray-400 mt-1">
              Available: {config.providers.available.join(', ')}
            </div>
          </div>
        </div>

        {/* Agent info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium mb-2">Agent</h3>
          <div className="text-sm text-gray-400">
            <div>Max tokens: {config.agent.maxTokens}</div>
            <div>Memory: {config.agent.memory?.enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-medium mb-2">Keyboard Shortcuts</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <div><kbd className="bg-gray-700 px-1 rounded">Enter</kbd> Send message</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Shift+Enter</kbd> New line</div>
          </div>
        </div>
      </div>
    </div>
  );
}
