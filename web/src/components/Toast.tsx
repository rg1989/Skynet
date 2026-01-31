import { useEffect, useState, useCallback } from 'react';
import { useStore, type ToastMessage } from '../store';

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  // Animate progress bar
  useEffect(() => {
    const startTime = toast.createdAt;
    const endTime = startTime + toast.duration;

    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);

      if (now >= endTime) {
        handleDismiss();
      }
    };

    // Update progress every 50ms for smooth animation
    const interval = setInterval(updateProgress, 50);
    updateProgress();

    return () => clearInterval(interval);
  }, [toast.createdAt, toast.duration]);

  const handleDismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => onDismiss(toast.id), 300);
  }, [isExiting, onDismiss, toast.id]);

  const bgColor = {
    success: 'bg-slate-800/95',
    error: 'bg-slate-800/95',
    info: 'bg-slate-800/95',
  }[toast.type];

  const borderColor = {
    success: 'border-emerald-500',
    error: 'border-red-500',
    info: 'border-violet-500',
  }[toast.type];

  const progressColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-violet-500',
  }[toast.type];

  const iconColor = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    info: 'text-violet-400',
  }[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden
        ${bgColor} ${borderColor}
        border rounded-xl shadow-2xl shadow-black/30
        backdrop-blur-sm
        min-w-[320px] max-w-[420px]
        transform transition-all duration-300 ease-out
        ${isExiting 
          ? 'opacity-0 translate-y-[-20px] scale-95' 
          : 'opacity-100 translate-y-0 scale-100'
        }
      `}
      style={{
        animation: isExiting ? undefined : 'toastSlideIn 0.3s ease-out',
      }}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
          {toast.type === 'success' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Text */}
        <p className="flex-1 text-sm text-white leading-relaxed pr-2">
          {toast.text}
        </p>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar at bottom */}
      <div className="h-1 bg-slate-700/50">
        <div
          className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Toast container component - renders at the top center of the viewport.
 * Add this once in your app layout as: <ToastContainer />
 */
export function ToastContainer() {
  const { toasts, removeToast, clearAllToasts } = useStore();

  if (toasts.length === 0) return null;

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Toast container */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}

        {/* Clear all button when multiple toasts */}
        {toasts.length > 1 && (
          <button
            onClick={clearAllToasts}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors backdrop-blur-sm"
          >
            Clear all ({toasts.length})
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Hook to show toasts from any component.
 * Usage: const { showToast } = useToast();
 *        showToast('success', 'Settings saved');
 */
export function useToast() {
  const { addToast, removeToast, clearAllToasts } = useStore();

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', text: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      addToast({
        id,
        type,
        text,
        duration,
        createdAt: Date.now(),
      });
      return id;
    },
    [addToast]
  );

  return { showToast, removeToast, clearAllToasts };
}
