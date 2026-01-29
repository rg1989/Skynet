interface ListeningOverlayProps {
  interimTranscript: string;
  finalTranscript: string;
  onCancel: () => void;
  onDone: () => void;
  isLoadingModel?: boolean;
  loadingProgress?: number;
}

/**
 * ListeningOverlay - Full-screen overlay shown while voice input is active
 * Also handles model loading state for local Whisper recognition
 */
export function ListeningOverlay({ 
  interimTranscript, 
  finalTranscript, 
  onCancel, 
  onDone,
  isLoadingModel = false,
  loadingProgress = 0,
}: ListeningOverlayProps) {
  const displayText = finalTranscript + interimTranscript;
  const hasContent = displayText.length > 0;
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Pulsing microphone icon */}
      <div className="relative mb-6">
        {/* Outer pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-32 h-32 rounded-full bg-violet-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <span className="absolute w-24 h-24 rounded-full bg-violet-500/30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
        </div>
        
        {/* Main mic button */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/40">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
            />
          </svg>
        </div>
      </div>

      {/* Status text */}
      {isLoadingModel ? (
        <>
          <h2 className="text-2xl font-medium text-white mb-2">
            Loading Speech Recognition
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Downloading Whisper model (first time only)...
          </p>
          {/* Progress bar */}
          <div className="w-64 h-2 bg-slate-700 rounded-full mb-8 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-medium text-white mb-4 flex items-center gap-2">
            Listening
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-thinking-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-thinking-dot" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-thinking-dot" style={{ animationDelay: '300ms' }} />
            </span>
          </h2>

          {/* Real-time transcript preview */}
          <div className="max-w-md px-6 mb-8 min-h-[60px]">
            {displayText ? (
              <p className="text-lg text-slate-300 text-center italic">
                "{displayText}"
              </p>
            ) : (
              <p className="text-lg text-slate-500 text-center">
                Start speaking...
              </p>
            )}
          </div>
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>
        
        {hasContent && (
          <button
            onClick={onDone}
            className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
