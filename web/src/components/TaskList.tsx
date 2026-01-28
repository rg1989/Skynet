import { useStore } from '../store';

export function TaskList() {
  const { activeRunId, activeTools, thinkingContent } = useStore();

  if (!activeRunId) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Active Tasks</h2>
        <div className="text-gray-500 text-center py-8">
          No active tasks
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Active Tasks</h2>
      
      {/* Current run */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-sm font-medium">Processing</span>
          <span className="text-xs text-gray-500 ml-auto">{activeRunId.slice(0, 12)}...</span>
        </div>
        
        {/* Active tools */}
        {activeTools.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-gray-400">Tools running:</div>
            {activeTools.map((tool, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="animate-spin text-blue-400">⚙️</span>
                <span className="text-blue-300">{tool.name}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Thinking content preview */}
        {thinkingContent && (
          <div className="mt-3">
            <div className="text-xs text-gray-400 mb-1">Output:</div>
            <div className="text-sm text-gray-300 bg-gray-900 rounded p-2 max-h-32 overflow-y-auto">
              {thinkingContent.slice(-500)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
