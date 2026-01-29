import { useState, useEffect, useCallback } from 'react';
import { ConfirmModal } from './ConfirmModal';

// Types for workflow data
interface Workflow {
  name: string;
  type: 'file' | 'dynamic';
  description: string;
  file?: string;
  steps?: number;
}

interface WorkflowRun {
  id: string;
  flow_name: string;
  status: 'success' | 'error' | 'running' | 'pending';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  result?: unknown;
  error?: string;
}

interface FlowsResponse {
  flows: Workflow[];
  count: number;
}

interface RunsResponse {
  runs: WorkflowRun[];
  count: number;
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Status badge component
function StatusBadge({ status }: { status: WorkflowRun['status'] }) {
  const styles = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    running: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status]}`}>
      {status}
    </span>
  );
}

// Type badge component
function TypeBadge({ type }: { type: 'file' | 'dynamic' }) {
  const styles = {
    file: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dynamic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[type]}`}>
      {type}
    </span>
  );
}

// Loading spinner
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <svg className={`${sizeClasses} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// Workflow card component
function WorkflowCard({ 
  workflow, 
  onRun, 
  onDelete,
  isRunning 
}: { 
  workflow: Workflow; 
  onRun: () => void;
  onDelete: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-slate-100 truncate">{workflow.name}</h3>
            <TypeBadge type={workflow.type} />
          </div>
          <p className="text-sm text-slate-400 line-clamp-2">
            {workflow.description || 'No description'}
          </p>
          {workflow.type === 'dynamic' && workflow.steps !== undefined && (
            <p className="text-xs text-slate-500 mt-1">
              {workflow.steps} step{workflow.steps !== 1 ? 's' : ''}
            </p>
          )}
          {workflow.type === 'file' && workflow.file && (
            <p className="text-xs text-slate-500 mt-1 truncate" title={workflow.file}>
              {workflow.file.split('/').pop()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isRunning ? (
              <>
                <Spinner size="sm" />
                <span>Running</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Run</span>
              </>
            )}
          </button>
          {workflow.type === 'dynamic' && (
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete workflow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Run history row component
function RunHistoryRow({ run }: { run: WorkflowRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-700/30 last:border-0">
      <div 
        className="flex items-center gap-4 py-3 px-4 hover:bg-slate-800/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-24 shrink-0">
          <StatusBadge status={run.status} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-slate-200 font-medium truncate">{run.flow_name}</span>
        </div>
        <div className="text-sm text-slate-400 w-20 text-right">
          {run.duration_ms ? formatDuration(run.duration_ms) : '-'}
        </div>
        <div className="text-sm text-slate-500 w-24 text-right">
          {formatRelativeTime(run.started_at)}
        </div>
        <svg 
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {expanded && (
        <div className="px-4 pb-3 text-sm">
          <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <span className="text-slate-500">Run ID:</span>
              <span className="text-slate-300 font-mono text-xs">{run.id}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500">Started:</span>
              <span className="text-slate-300">{new Date(run.started_at).toLocaleString()}</span>
            </div>
            {run.completed_at && (
              <div className="flex gap-2">
                <span className="text-slate-500">Completed:</span>
                <span className="text-slate-300">{new Date(run.completed_at).toLocaleString()}</span>
              </div>
            )}
            {run.error && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                <span className="font-medium">Error: </span>
                {run.error}
              </div>
            )}
            {run.result !== undefined && run.result !== null && (
              <div className="mt-2">
                <span className="text-slate-500">Result:</span>
                <pre className="mt-1 p-2 bg-slate-800 rounded text-xs text-slate-300 overflow-x-auto">
                  {typeof run.result === 'string' ? run.result : JSON.stringify(run.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Empty state component
function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm">{description}</p>
    </div>
  );
}

/**
 * WorkflowManager - Dashboard for managing Prefect workflows
 */
export function WorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningWorkflows, setRunningWorkflows] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [prefectAvailable, setPrefectAvailable] = useState(true);

  // Fetch workflows and runs
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Check if Prefect Bridge is available
      const healthRes = await fetch('/prefect/health');
      if (!healthRes.ok) {
        setPrefectAvailable(false);
        setLoading(false);
        return;
      }
      setPrefectAvailable(true);

      // Fetch workflows
      const flowsRes = await fetch('/prefect/flows');
      if (flowsRes.ok) {
        const data: FlowsResponse = await flowsRes.json();
        setWorkflows(data.flows || []);
      }

      // Fetch recent runs
      const runsRes = await fetch('/prefect/runs?limit=20');
      if (runsRes.ok) {
        const data: RunsResponse = await runsRes.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflow data:', err);
      setPrefectAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Run a workflow
  const runWorkflow = async (workflow: Workflow) => {
    setRunningWorkflows(prev => new Set(prev).add(workflow.name));
    
    try {
      const res = await fetch(`/prefect/flows/${encodeURIComponent(workflow.name)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: {} }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to run workflow');
      }
      
      // Refresh data after run
      setTimeout(fetchData, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setRunningWorkflows(prev => {
        const next = new Set(prev);
        next.delete(workflow.name);
        return next;
      });
    }
  };

  // Delete a workflow
  const deleteWorkflow = async (workflow: Workflow) => {
    try {
      const res = await fetch(`/prefect/flows/${encodeURIComponent(workflow.name)}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete workflow');
      }
      
      // Refresh data
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
        <span className="ml-3 text-slate-400">Loading workflows...</span>
      </div>
    );
  }

  // Prefect not available
  if (!prefectAvailable) {
    return (
      <EmptyState
        title="Prefect Bridge Unavailable"
        description="The Prefect Bridge server is not running. Start it with 'make prefect' or enable auto-start in config."
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-400 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Available Workflows Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Available Workflows</h2>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        {workflows.length === 0 ? (
          <EmptyState
            title="No Workflows"
            description="Create workflows by asking the AI assistant or add Python flow files to prefect/flows/"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-3">
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.name}
                workflow={workflow}
                onRun={() => runWorkflow(workflow)}
                onDelete={() => setDeleteTarget(workflow)}
                isRunning={runningWorkflows.has(workflow.name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Runs Section */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent Runs</h2>
        
        {runs.length === 0 ? (
          <EmptyState
            title="No Run History"
            description="Run a workflow to see execution history here"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        ) : (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 py-2 px-4 bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
              <div className="w-24">Status</div>
              <div className="flex-1">Workflow</div>
              <div className="w-20 text-right">Duration</div>
              <div className="w-24 text-right">Time</div>
              <div className="w-4"></div>
            </div>
            {/* Rows */}
            {runs.map((run) => (
              <RunHistoryRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title="Delete Workflow"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger={true}
          onConfirm={() => deleteWorkflow(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
