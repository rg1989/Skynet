import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface InputBarProps {
  onSend: (text: string) => void;
  onVoiceInput?: () => void;
  disabled?: boolean;
  voiceSupported?: boolean;
  placeholder?: string;
}

export function InputBar({ 
  onSend, 
  onVoiceInput,
  disabled = false, 
  voiceSupported = false,
  placeholder = 'Type a message...' 
}: InputBarProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={disabled}
        rows={1}
        className={`flex-1 bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      {/* Microphone button - only show if voice is supported */}
      {voiceSupported && onVoiceInput && (
        <button
          onClick={onVoiceInput}
          disabled={disabled}
          className="h-10 w-10 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center cursor-pointer"
          title="Voice input"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
            />
          </svg>
        </button>
      )}
      
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        Send
      </button>
    </div>
  );
}
