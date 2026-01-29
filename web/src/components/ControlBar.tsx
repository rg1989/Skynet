import { InputBar } from './InputBar';

interface ControlBarProps {
  isProcessing: boolean;
  isDisabled: boolean;
  onSendText: (text: string) => void;
  onStop: () => void;
  onVoiceInput?: () => void;
  voiceSupported?: boolean;
}

export function ControlBar({
  isProcessing,
  isDisabled,
  onSendText,
  onStop,
  onVoiceInput,
  voiceSupported = false,
}: ControlBarProps) {
  return (
    <div className="border-t border-slate-700/50 px-6 py-3 bg-[#1e2227]">
      <div className="max-w-3xl mx-auto">
        {/* Input row */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <InputBar 
              onSend={onSendText} 
              onVoiceInput={onVoiceInput}
              voiceSupported={voiceSupported}
              disabled={isProcessing || isDisabled} 
            />
          </div>
          {isProcessing && (
            <button
              onClick={onStop}
              className="h-10 px-4 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
