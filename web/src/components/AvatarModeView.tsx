import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore, type Message, type AvatarDesign } from '../store';
import { CyberFace } from './CyberFace';
import { ImageAvatar } from './ImageAvatar';
import { ChatMessage } from './ChatMessage';
import { InputBar } from './InputBar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { TranscribingIndicator } from './TranscribingIndicator';
import { ContentDisplay } from './ContentDisplay';
import { useTTS, stripMarkdownForTTS } from '../hooks/useTTS';

interface AvatarModeViewProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onStop: () => void;
  onVoiceInput: () => void;
  isProcessing: boolean;
  voiceSupported: boolean;
  isConnected: boolean;
}

/**
 * Avatar Mode View - split layout with cyber face on left and chat on right.
 * Features TTS integration for speaking assistant messages with mouth animation.
 */
export function AvatarModeView({
  messages,
  onSendMessage,
  onStop,
  onVoiceInput,
  isProcessing,
  voiceSupported,
  isConnected,
}: AvatarModeViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previousMessagesRef = useRef<Message[]>([]);

  const {
    avatarDesign,
    setAvatarDesign,
    avatarRatio,
    setAvatarRatio,
    showContent,
    setShowContent,
    contentUrl,
    setContentUrl,
    ttsEnabled,
    setTtsEnabled,
    isThinking,
    thinkingContent,
    isTranscribing,
    setAvatarModeEnabled,
  } = useStore();

  // TTS hook for speaking assistant messages
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: ttsSupported, voices, selectedVoice, setVoice } = useTTS();

  // Extract user message history for up/down arrow navigation in input
  const userMessageHistory = useMemo(() => 
    messages
      .filter(m => m.role === 'user')
      .map(m => m.content),
    [messages]
  );

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, thinkingContent, isTranscribing, scrollToBottom]);

  // Speak new assistant messages when TTS is enabled
  useEffect(() => {
    if (!ttsEnabled || !ttsSupported) return;

    const prevIds = new Set(previousMessagesRef.current.map(m => m.id));
    const newAssistantMessages = messages.filter(
      m => m.role === 'assistant' && !prevIds.has(m.id)
    );

    if (newAssistantMessages.length > 0) {
      const latest = newAssistantMessages[newAssistantMessages.length - 1];
      const cleanText = stripMarkdownForTTS(latest.content);
      if (cleanText) {
        speak(cleanText);
      }
    }

    previousMessagesRef.current = messages;
  }, [messages, ttsEnabled, ttsSupported, speak]);

  // Stop speaking when user sends a new message
  useEffect(() => {
    if (isProcessing && isSpeaking) {
      stopSpeaking();
    }
  }, [isProcessing, isSpeaking, stopSpeaking]);

  // Handle divider dragging for resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      setAvatarRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setAvatarRatio]);

  // Avatar design options
  const designOptions: { value: AvatarDesign; label: string }[] = [
    { value: 'image', label: 'Hawking' },
    { value: 'geometric', label: 'Geometric' },
    { value: 'holographic', label: 'Holographic' },
    { value: 'android', label: 'Android' },
  ];

  // For Hawking avatar, force Eddy voice
  const isHawkingAvatar = avatarDesign === 'image';
  
  // Auto-select Eddy voice for Hawking avatar
  useEffect(() => {
    if (isHawkingAvatar && voices.length > 0) {
      const eddyVoice = voices.find(v => v.name.toLowerCase().includes('eddy') && v.lang.startsWith('en'));
      if (eddyVoice && selectedVoice?.name !== eddyVoice.name) {
        setVoice(eddyVoice);
      }
    }
  }, [isHawkingAvatar, voices, selectedVoice, setVoice]);

  return (
    <div ref={containerRef} className="flex-1 flex h-full bg-[#15181c] relative">
      {/* Left panel - Avatar */}
      <div
        className="flex flex-col bg-[#1a1d21] relative"
        style={{ width: `${avatarRatio * 100}%` }}
      >
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* Exit Avatar Mode */}
            <button
              onClick={() => setAvatarModeEnabled(false)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Exit Avatar Mode"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            {/* Connection status */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>

          <div className="flex items-center gap-2">
            {/* TTS toggle */}
            {ttsSupported && (
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  ttsEnabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
                title={ttsEnabled ? 'Disable voice' : 'Enable voice'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {ttsEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm11.414-5l-2-2m0 4l2 2m2-6l-2 2m2 2l-2 2" />
                  )}
                </svg>
              </button>
            )}

            {/* Avatar design selector */}
            <select
              value={avatarDesign}
              onChange={(e) => setAvatarDesign(e.target.value as AvatarDesign)}
              className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
            >
              {designOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Voice selector (if TTS enabled and not Hawking avatar) */}
            {ttsEnabled && voices.length > 0 && !isHawkingAvatar && (
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const voice = voices.find(v => v.name === e.target.value);
                  setVoice(voice || null);
                }}
                className="bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/50 max-w-[120px]"
                title="Voice"
              >
                {voices.slice(0, 20).map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name.split(' ').slice(0, 2).join(' ')}
                  </option>
                ))}
              </select>
            )}
            
            {/* Show locked voice indicator for Hawking */}
            {ttsEnabled && isHawkingAvatar && (
              <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-700/30 rounded-lg text-xs text-slate-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Eddy</span>
              </div>
            )}
          </div>
        </div>

        {/* Avatar display area */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {avatarDesign === 'image' ? (
            <ImageAvatar
              isSpeaking={isSpeaking}
              className="w-full max-w-md"
            />
          ) : (
            <CyberFace
              design={avatarDesign}
              isSpeaking={isSpeaking || isThinking}
              className="w-full max-w-md"
            />
          )}

          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-400">Speaking...</span>
            </div>
          )}

          {/* Content display overlay */}
          {showContent && contentUrl && (
            <ContentDisplay
              url={contentUrl}
              onClose={() => {
                setShowContent(false);
                setContentUrl(null);
              }}
            />
          )}
        </div>
      </div>

      {/* Resizable divider */}
      <div
        ref={dividerRef}
        onMouseDown={handleMouseDown}
        className={`w-1 bg-slate-700/50 hover:bg-emerald-500/50 cursor-col-resize transition-colors flex-shrink-0 ${
          isDragging ? 'bg-emerald-500/70' : ''
        }`}
      />

      {/* Right panel - Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#15181c]">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-[#1e2227]">
          <h2 className="text-sm font-medium text-slate-300">Chat</h2>
          
          {/* Stop button when processing */}
          {isProcessing && (
            <button
              onClick={onStop}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-8">
              <p className="text-sm">Start a conversation...</p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Transcribing indicator */}
          {isTranscribing && <TranscribingIndicator />}

          {/* Thinking indicator */}
          {isThinking && !thinkingContent && <ThinkingIndicator />}

          {/* Streaming content */}
          {thinkingContent && (
            <div className="flex gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="5" y="8" width="14" height="10" rx="2" strokeWidth={1.5} />
                  <line x1="12" y1="8" x2="12" y2="5" strokeWidth={1.5} strokeLinecap="round" />
                  <circle cx="12" cy="4" r="1" fill="currentColor" />
                  <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                  <line x1="9" y1="15" x2="15" y2="15" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </div>
              <div className="bg-[#2a2d32] rounded-2xl rounded-tl-md px-4 py-3 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 max-w-[75%]">
                <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                  {thinkingContent}
                  <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-slate-700/50 bg-[#1e2227]">
          <InputBar
            onSend={onSendMessage}
            onVoiceInput={onVoiceInput}
            disabled={!isConnected || isProcessing}
            voiceSupported={voiceSupported}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            messageHistory={userMessageHistory}
          />
        </div>
      </div>
    </div>
  );
}

export default AvatarModeView;
