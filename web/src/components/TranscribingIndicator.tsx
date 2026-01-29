/**
 * TranscribingIndicator - Shows user avatar with "Transcribing" label while processing speech
 * Similar to ThinkingIndicator but uses user styling (violet/purple) and right-aligned
 */
export function TranscribingIndicator() {
  return (
    <div className="flex gap-3 mb-5 flex-row-reverse">
      {/* User Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      
      {/* Transcribing bubble with label and animated dots */}
      <div className="bg-slate-800/90 rounded-2xl rounded-tr-md px-4 py-3 border border-violet-500/30 shadow-lg shadow-violet-500/10">
        <div className="flex items-center gap-2">
          <span className="text-sm text-violet-300 font-medium">Transcribing</span>
          <div className="flex items-center gap-1">
            <span 
              className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-transcribing-dot"
              style={{ animationDelay: '0ms' }}
            />
            <span 
              className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-transcribing-dot"
              style={{ animationDelay: '150ms' }}
            />
            <span 
              className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-transcribing-dot"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
