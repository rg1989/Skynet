import { useEffect, useRef } from 'react';
import type { ToolConfirmationRequest } from '../store';

interface SecurityConfirmModalProps {
  isOpen: boolean;
  confirmation: ToolConfirmationRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Security confirmation modal for high-risk tool execution
 * Features prominent warning styling to alert users to potentially dangerous actions
 */
export function SecurityConfirmModal({
  isOpen,
  confirmation,
  onConfirm,
  onCancel,
}: SecurityConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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
        <div className="px-6 py-5">
          {/* Risk warning */}
          <div className="flex items-start gap-3 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-300 text-sm">
              The AI agent is requesting to perform a <span className="font-semibold text-red-400">potentially risky action</span>. 
              This action could modify files, execute code, or send data externally.
            </p>
          </div>

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

          {/* Command/Details */}
          <div className="mb-6">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2 font-medium">
              Details
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-sm">
              <code className="text-amber-300 whitespace-pre-wrap break-all">
                {details.command}
              </code>
            </div>
          </div>

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
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Allow Execution
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
