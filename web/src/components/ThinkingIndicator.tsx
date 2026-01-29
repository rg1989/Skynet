/**
 * ThinkingIndicator - Shows AI avatar with animated dots while thinking
 */
export function ThinkingIndicator() {
  return (
    <div className="flex gap-3 mb-5">
      {/* AI Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {/* Robot head */}
          <rect x="5" y="8" width="14" height="10" rx="2" strokeWidth={1.5} />
          {/* Antenna */}
          <line x1="12" y1="8" x2="12" y2="5" strokeWidth={1.5} strokeLinecap="round" />
          <circle cx="12" cy="4" r="1" fill="currentColor" />
          {/* Eyes */}
          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
          {/* Mouth */}
          <line x1="9" y1="15" x2="15" y2="15" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </div>
      
      {/* Thinking bubble with animated dots */}
      <div className="bg-[#2a2d32] rounded-2xl rounded-tl-md px-4 py-3 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
        <div className="flex items-center gap-1.5">
          <span 
            className="w-2 h-2 bg-emerald-400 rounded-full animate-thinking-dot"
            style={{ animationDelay: '0ms' }}
          />
          <span 
            className="w-2 h-2 bg-emerald-400 rounded-full animate-thinking-dot"
            style={{ animationDelay: '150ms' }}
          />
          <span 
            className="w-2 h-2 bg-emerald-400 rounded-full animate-thinking-dot"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
