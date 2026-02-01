import { useEffect, useRef, useState } from 'react';
import type { ToolConfirmationRequest, AuthorizationScope } from '../store';

interface SecurityConfirmModalProps {
  isOpen: boolean;
  confirmation: ToolConfirmationRequest;
  onConfirm: (remember: boolean, scope?: AuthorizationScope) => void;
  onCancel: () => void;
}

// Scope labels for the dropdown
const SCOPE_LABELS: Record<AuthorizationScope, string> = {
  exact: 'This exact action only',
  pattern: 'Similar actions (same command type)',
  tool: 'All actions of this type',
};

// Risk level colors
const RISK_COLORS = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  high: 'text-red-400 bg-red-500/10 border-red-500/30',
};

/**
 * Security confirmation modal for high-risk tool execution
 * Features prominent warning styling and remember option for authorizations
 */
export function SecurityConfirmModal({
  isOpen,
  confirmation,
  onConfirm,
  onCancel,
}: SecurityConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [remember, setRemember] = useState(false);
  const [selectedScope, setSelectedScope] = useState<AuthorizationScope>('exact');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRemember(false);
      setSelectedScope(confirmation.suggestedScopes?.[0] || 'exact');
    }
  }, [isOpen, confirmation.suggestedScopes]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(remember, remember ? selectedScope : undefined);
  };

  // Extract command or action details from the tool params
  const getActionDetails = () => {
    const { toolName, toolParams } = confirmation;
    
    switch (toolName) {
      case 'exec':
        return {
          actionType: 'Shell Command',
          command: String(toolParams.command || 'Unknown command'),
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        };
      case 'gmail_send':
        return {
          actionType: 'Send Email',
          command: `To: ${toolParams.to || 'Unknown'}\nSubject: ${toolParams.subject || 'No subject'}`,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        };
      case 'write_file':
      case 'edit_file':
        return {
          actionType: toolName === 'write_file' ? 'Write File' : 'Edit File',
          command: String(toolParams.path || 'Unknown path'),
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        };
      default:
        return {
          actionType: 'Tool Execution',
          command: toolName,
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        };
    }
  };

  const details = getActionDetails();
  const explanation = confirmation.commandExplanation;
  const suggestedScopes = confirmation.suggestedScopes || ['exact', 'tool'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with red tint */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-[#1e2227] border-2 border-red-500/50 rounded-xl shadow-2xl shadow-red-500/20 max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Warning header with red background */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
          {/* Warning icon */}
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Security Confirmation Required</h3>
            <p className="text-red-100 text-sm">Review this action carefully before proceeding</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {/* Action type */}
          <div className="mb-4">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2 font-medium">
              Action Type
            </div>
            <div className="flex items-center gap-2 text-white">
              <span className="text-amber-400">{details.icon}</span>
              <span className="font-semibold">{details.actionType}</span>
            </div>
          </div>

          {/* Command Explanation (if available) */}
          {explanation && (
            <div className="mb-4">
              <div className="text-slate-400 text-xs uppercase tracking-wide mb-2 font-medium">
                What This Does
              </div>
              <div className={`p-3 rounded-lg border ${RISK_COLORS[explanation.riskLevel]}`}>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">{explanation.summary}</p>
                    <p className="text-sm opacity-80 mt-1">{explanation.details}</p>
                  </div>
                </div>
                
                {/* Warnings */}
                {explanation.warnings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/20 space-y-1">
                    {explanation.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Command/Details */}
          <div className="mb-4">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2 font-medium">
              Command
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-sm">
              <code className="text-amber-300 whitespace-pre-wrap break-all">
                {details.command}
              </code>
            </div>
          </div>

          {/* Remember Authorization */}
          {confirmation.canRemember && (
            <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <div>
                  <span className="font-medium text-white">Remember this authorization</span>
                  <p className="text-sm text-slate-400 mt-1">
                    Don't ask again for similar actions. You can revoke this later in Settings.
                  </p>
                </div>
              </label>

              {/* Scope selector (shown when remember is checked) */}
              {remember && (
                <div className="mt-3 pl-7">
                  <label className="block text-sm text-slate-400 mb-2">Authorization scope:</label>
                  <select
                    value={selectedScope}
                    onChange={(e) => setSelectedScope(e.target.value as AuthorizationScope)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {suggestedScopes.map((scope) => (
                      <option key={scope} value={scope}>
                        {SCOPE_LABELS[scope]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Deny
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {remember ? 'Allow & Remember' : 'Allow Once'}
            </button>
          </div>

          {/* Timeout notice */}
          <p className="text-slate-500 text-xs text-center mt-4">
            This request will timeout in 2 minutes if no action is taken
          </p>
        </div>
      </div>
    </div>
  );
}
