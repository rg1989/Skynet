import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore, type Message, type SessionInfo } from '../store';
import { ChatMessage } from './ChatMessage';
import { ChatHeader } from './ChatHeader';
import { ControlBar } from './ControlBar';
import { SessionSidebar } from './SessionSidebar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { TranscribingIndicator } from './TranscribingIndicator';
import { ListeningOverlay } from './ListeningOverlay';
import { AvatarModeView } from './AvatarModeView';
import { StreamingCodeBlock } from './StreamingCodeBlock';
import { SecurityConfirmModal } from './SecurityConfirmModal';
import { useWhisperRecognition } from '../hooks/useWhisperRecognition';
import { useWebSocket, clearCurrentRun } from '../hooks/useWebSocket';
import { formatThoughtProcess } from '../utils/formatThoughtProcess';

/**
 * Segment types for parsed streaming content
 */
type StreamingSegment = 
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; code: string; isComplete: boolean };

/**
 * Parse streaming content to detect code blocks (complete and incomplete)
 * Returns an array of segments that can be rendered appropriately
 */
function parseStreamingContent(content: string): StreamingSegment[] {
  const segments: StreamingSegment[] = [];
  
  // Regex to match code blocks - both complete and incomplete
  // Complete: ```language\ncode\n```
  // Incomplete: ```language\ncode (no closing ```)
  const codeBlockPattern = /```(\w*)\n([\s\S]*?)```|```(\w*)\n?([\s\S]*)$/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockPattern.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index).trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }
    
    // Determine if this is a complete or incomplete code block
    const isComplete = match[1] !== undefined; // Complete blocks match first alternative
    const language = isComplete ? match[1] : (match[3] || '');
    const code = isComplete ? match[2] : (match[4] || '');
    
    segments.push({
      type: 'code',
      language: language || 'text',
      code: code.trim(),
      isComplete,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last code block
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex).trim();
    if (remainingText) {
      segments.push({ type: 'text', content: remainingText });
    }
  }
  
  // If no code blocks found, return entire content as text
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content: content.trim() });
  }
  
  return segments;
}

// Thinking icon for streaming content
function ThinkingIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

/**
 * FilmReelThoughtStep - Shows one thought step at a time with slide animation
 * Like a film reel, steps slide up and out as new ones slide in from below
 */
function FilmReelThoughtStep({ 
  steps, 
  isClosing = false 
}: { 
  steps: string[]; 
  isClosing?: boolean;
}) {
  const prevStepCountRef = useRef(0);
  const [displayStep, setDisplayStep] = useState<{ text: string; index: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  
  // Get the current (last) step
  const currentStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const currentIndex = steps.length;
  
  useEffect(() => {
    if (currentStep && currentIndex > prevStepCountRef.current) {
      // New step arrived - trigger animation
      if (displayStep) {
        setIsAnimating(true);
        // After exit animation, show new step with enter animation
        setTimeout(() => {
          setDisplayStep({ text: currentStep, index: currentIndex });
          setAnimationKey(prev => prev + 1);
          setIsAnimating(false);
        }, 250); // Match animation duration
      } else {
        // First step - just show it
        setDisplayStep({ text: currentStep, index: currentIndex });
      }
      prevStepCountRef.current = currentIndex;
    }
  }, [currentStep, currentIndex, displayStep]);
  
  if (!displayStep) return null;
  
  return (
    <div className="relative h-8 overflow-hidden">
      <div
        key={animationKey}
        className={`absolute inset-0 flex items-center text-xs text-slate-400 italic truncate ${
          isAnimating 
            ? 'animate-slide-up-out' 
            : 'animate-slide-up-in'
        } ${isClosing ? 'opacity-50' : ''}`}
      >
        <span className="text-slate-500 mr-2 font-medium not-italic flex-shrink-0">
          {displayStep.index}.
        </span>
        <span className="truncate">{displayStep.text}</span>
      </div>
    </div>
  );
}

/**
 * StreamingContent - Film reel style display showing one thought step at a time
 * Steps slide up and out as new ones arrive, creating a smooth film reel effect.
 * Fixed height to match collapsed ThoughtProcessBox for seamless transition.
 */
function StreamingContent({ content, isClosing = false }: { content: string; isClosing?: boolean }) {
  const segments = parseStreamingContent(content);
  
  // Collect all text steps from segments
  const allSteps: string[] = [];
  let hasCodeBlock = false;
  
  for (const segment of segments) {
    if (segment.type === 'text') {
      const steps = formatThoughtProcess(segment.content);
      allSteps.push(...steps);
    } else if (segment.type === 'code') {
      hasCodeBlock = true;
    }
  }
  
  return (
    <div className="text-sm">
      {/* Header row - matches ThoughtProcessBox collapsed button height */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {/* Chevron icon (matches collapsed state) */}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <ThinkingIcon />
        <span className="font-medium">Thought Process</span>
        {/* Step counter with loading indicator */}
        <span className="text-slate-600 flex items-center gap-1.5">
          ({allSteps.length} step{allSteps.length !== 1 ? 's' : ''})
          {!isClosing && (
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </span>
      </div>
      
      {/* Film reel single step display - fixed height */}
      {allSteps.length > 0 && !isClosing && (
        <div className="mt-2 bg-slate-900/60 rounded-lg border border-slate-700/40 px-3 py-2">
          <FilmReelThoughtStep 
            steps={allSteps} 
            isClosing={isClosing}
          />
        </div>
      )}
      
      {/* Code block placeholder if generating code/diagram */}
      {hasCodeBlock && !isClosing && (
        <div className="mt-2">
          {segments.map((segment, index) => {
            if (segment.type === 'code') {
              return (
                <StreamingCodeBlock
                  key={index}
                  language={segment.language}
                  code={segment.code}
                  isComplete={segment.isComplete}
                />
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [isStreamingClosing, setIsStreamingClosing] = useState(false);
  
  const { 
    messages, 
    setMessages,
    addMessage, 
    connected,
    isThinking,
    thinkingContent, 
    activeRunId,
    setActiveRunId,
    setIsThinking,
    setThinkingContent,
    activeTools,
    clearActiveTools,
    currentSessionKey,
    setCurrentSession,
    setSessions,
    isListening,
    setIsListening,
    isTranscribing,
    setIsTranscribing,
    avatarModeEnabled,
    avatarDesign,
    pendingConfirmation,
    setPendingConfirmation,
  } = useStore();

  // WebSocket hook for sending confirmation responses
  const { sendMessage } = useWebSocket();

  // Speech recognition hook (local Whisper-based, no API key needed)
  const {
    isListening: speechIsListening,
    isLoading: whisperLoading,
    isTranscribing: whisperIsTranscribing,
    loadingProgress: whisperProgress,
    transcript,
    interimTranscript,
    isSupported: voiceSupported,
    error: speechError,
    silenceProgress,
    hasSpeechStarted,
    startListening,
    stopListening,
    cancelListening,
  } = useWhisperRecognition();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, thinkingContent, isTranscribing, scrollToBottom]);

  // Sync speech recognition state with store
  useEffect(() => {
    setIsListening(speechIsListening);
  }, [speechIsListening, setIsListening]);

  // Show speech recognition errors to the user
  useEffect(() => {
    if (speechError) {
      const errorMessages: Record<string, string> = {
        'network': 'Voice input unavailable: Could not connect to speech recognition service. Please check your internet connection.',
        'not-allowed': 'Voice input unavailable: Microphone access was denied. Please allow microphone access in your browser settings.',
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'Voice input unavailable: No microphone found. Please connect a microphone and try again.',
        'service-not-allowed': 'Voice input unavailable: Speech recognition service is not allowed. Please try a different browser.',
      };
      
      const message = errorMessages[speechError] || `Voice input error: ${speechError}`;
      
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system',
        content: message,
        timestamp: Date.now(),
      });
    }
  }, [speechError, addMessage]);

  // Load session history when session changes
  const loadSessionHistory = useCallback(async (sessionKey: string) => {
    if (!sessionKey) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionKey}`);
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        // Convert backend messages to frontend format
        const formattedMessages: Message[] = data.messages.map((msg: { role: string; content: string; timestamp: number; thoughtProcess?: string }, index: number) => ({
          id: `msg_${msg.timestamp}_${index}`,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
          thoughtProcess: msg.thoughtProcess,
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
      setMessages([]);
    }
  }, [setMessages]);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Fetch available sessions
        const response = await fetch('/api/sessions');
        const data = await response.json();
        const sessions: SessionInfo[] = data.sessions || [];
        setSessions(sessions);

        // Check if current session key exists in sessions
        const storedKey = currentSessionKey;
        const sessionExists = storedKey && sessions.some(s => s.key === storedKey);

        if (sessionExists) {
          // Use the stored session and load its history
          loadSessionHistory(storedKey);
        } else if (sessions.length > 0) {
          // Select the most recent session
          const mostRecent = sessions[0]; // Already sorted by lastActivity
          setCurrentSession(mostRecent.key);
          loadSessionHistory(mostRecent.key);
        } else {
          // No sessions exist, use a default key
          const defaultKey = 'web-default';
          setCurrentSession(defaultKey);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        // Fallback to default session
        const defaultKey = 'web-default';
        setCurrentSession(defaultKey);
        setInitialized(true);
      }
    };

    initializeSession();
  }, []); // Only run on mount

  // Load history when session changes (after initialization)
  useEffect(() => {
    if (initialized && currentSessionKey) {
      loadSessionHistory(currentSessionKey);
    }
  }, [currentSessionKey, initialized, loadSessionHistory]);

  // Refresh sessions list after sending a message
  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  }, [setSessions]);

  const handleSessionChange = useCallback((key: string) => {
    loadSessionHistory(key);
  }, [loadSessionHistory]);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setThinkingContent(''); // Reset streaming content

    // Refresh sessions immediately after sending (optimistic update)
    // This ensures new chats appear in the sidebar right away
    setTimeout(() => refreshSessions(), 500);

    try {
      // Determine persona based on avatar mode
      const persona = avatarModeEnabled && avatarDesign === 'image' ? 'hawking' : undefined;
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionKey: currentSessionKey,
          persona,
        }),
      });

      const data = await response.json();
      
      // Capture the thought process before clearing state
      // Use getState() to get the current value since thinkingContent from hook may be stale
      const capturedThoughtProcess = useStore.getState().thinkingContent;
      
      if (data.response) {
        // Trigger closing animation on streaming content
        // The streaming view fades out quickly (300ms) to match transition-opacity duration
        setIsStreamingClosing(true);
        
        // Wait for fade animation to complete, then add final message
        // The final message appears with the same thought process header (collapsed)
        // creating a seamless visual transition
        setTimeout(() => {
          // Clear streaming state
          clearCurrentRun();
          setIsThinking(false);
          setThinkingContent('');
          setActiveRunId(null);
          clearActiveTools();
          setIsStreamingClosing(false);
          
          // Now add the final message with captured thought process
          addMessage({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: Date.now(),
            // Always include thought process if we captured any streaming content
            // This preserves the step-by-step work the AI did
            thoughtProcess: capturedThoughtProcess?.trim() || undefined,
          });
          
          // Refresh sessions list to update message counts
          refreshSessions();
        }, 300); // Match the 300ms transition-opacity duration
      } else if (data.error) {
        addMessage({
          id: `msg_${Date.now()}`,
          role: 'system',
          content: `Error: ${data.error}`,
          timestamp: Date.now(),
        });
        // Clear state on error since there won't be an agent:end event
        clearCurrentRun();
        setIsThinking(false);
        setThinkingContent('');
        setActiveRunId(null);
        clearActiveTools();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Clear all state on network error since there won't be an agent:end event
      clearCurrentRun();
      setIsThinking(false);
      setThinkingContent('');
      setActiveRunId(null);
      clearActiveTools();
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system',
        content: 'Failed to send message. Please check your connection.',
        timestamp: Date.now(),
      });
    }
  }, [addMessage, setIsThinking, setThinkingContent, setActiveRunId, clearActiveTools, currentSessionKey, refreshSessions, avatarModeEnabled, avatarDesign]);

  const handleStop = useCallback(() => {
    // Clear module-level WebSocket state to stop processing incoming events
    clearCurrentRun();
    // Clear React/Zustand state
    setActiveRunId(null);
    setIsThinking(false);
    setThinkingContent('');
    clearActiveTools();
  }, [setActiveRunId, setIsThinking, setThinkingContent, clearActiveTools]);

  // Handle speech recognition completion - placed after handleSendMessage is defined
  useEffect(() => {
    // When listening stops and we have a transcript, process it
    if (!speechIsListening && transcript && isListening === false) {
      // Show transcribing indicator briefly, then send the message
      setIsTranscribing(true);
      
      // Small delay to show the transcribing indicator
      const timer = setTimeout(() => {
        setIsTranscribing(false);
        handleSendMessage(transcript);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [speechIsListening, transcript, isListening, setIsTranscribing, handleSendMessage]);

  // Voice input handlers
  const handleVoiceInput = useCallback(() => {
    startListening();
  }, [startListening]);

  const handleCancelVoice = useCallback(() => {
    cancelListening();
    setIsListening(false);
    setIsTranscribing(false);
  }, [cancelListening, setIsListening, setIsTranscribing]);

  const handleDoneVoice = useCallback(() => {
    // Stop listening and process the transcript
    stopListening();
    setIsListening(false);
    
    // Only use transcript, not interimTranscript (which may contain status text like "Processing...")
    const finalText = transcript.trim();
    if (finalText) {
      setIsTranscribing(true);
      setTimeout(() => {
        setIsTranscribing(false);
        handleSendMessage(finalText);
      }, 500);
    } else {
      // No valid audio was recorded - show informational message to user only (not sent to model)
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system',
        content: 'No audio was recorded. Please try again.',
        timestamp: Date.now(),
      });
    }
  }, [stopListening, setIsListening, transcript, setIsTranscribing, handleSendMessage, addMessage]);

  const isProcessing = activeRunId !== null || isThinking || thinkingContent.length > 0 || isTranscribing;

  // Extract user message history for up/down arrow navigation in input
  const userMessageHistory = useMemo(() => 
    messages
      .filter(m => m.role === 'user')
      .map(m => m.content),
    [messages]
  );

  // Tool confirmation handlers
  const handleConfirmTool = useCallback(() => {
    if (pendingConfirmation) {
      sendMessage('confirm_response', {
        confirmId: pendingConfirmation.confirmId,
        approved: true,
      });
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, sendMessage, setPendingConfirmation]);

  const handleDenyTool = useCallback(() => {
    if (pendingConfirmation) {
      sendMessage('confirm_response', {
        confirmId: pendingConfirmation.confirmId,
        approved: false,
      });
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, sendMessage, setPendingConfirmation]);

  return (
    <div className="flex h-full bg-[#15181c]">
      {/* Session sidebar */}
      <SessionSidebar onSessionChange={handleSessionChange} />

      {/* Conditionally render Avatar Mode or standard chat */}
      {avatarModeEnabled ? (
        <AvatarModeView
          messages={messages}
          onSendMessage={handleSendMessage}
          onStop={handleStop}
          onVoiceInput={handleVoiceInput}
          isProcessing={isProcessing}
          voiceSupported={voiceSupported}
          isConnected={connected}
        />
      ) : (
        /* Main chat area - standard mode */
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader isConnected={connected} />

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 mt-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="5" y="8" width="14" height="10" rx="2" strokeWidth={1.5} />
                      <line x1="12" y1="8" x2="12" y2="5" strokeWidth={1.5} strokeLinecap="round" />
                      <circle cx="12" cy="4" r="1" fill="currentColor" />
                      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                      <line x1="9" y1="15" x2="15" y2="15" strokeWidth={1.5} strokeLinecap="round" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-medium text-slate-300 mb-2">Welcome to Skynet</h2>
                  <p className="text-slate-500">Send a message to get started</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              
              {/* Transcribing indicator - shown while Whisper is processing voice input */}
              {(isTranscribing || whisperIsTranscribing) && <TranscribingIndicator />}
              
              {/* Thinking indicator - shown while waiting for first token or during tool execution */}
              {(isThinking || activeTools.length > 0) && !thinkingContent && <ThinkingIndicator />}
              
              {/* Streaming content - Film reel thought process display */}
              {/* Styled to match the collapsed ThoughtProcessBox in final messages */}
              {/* Height stays consistent for seamless transition to final message */}
              {thinkingContent && (
                <div 
                  className={`flex gap-3 mb-5 transition-opacity duration-300 ease-out ${
                    isStreamingClosing ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {/* Bot avatar */}
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
                  {/* Message bubble - matches ChatMessage assistant bubble */}
                  <div className="bg-[#2a2d32] rounded-2xl rounded-tl-md px-4 py-3 border border-slate-600/30 max-w-[75%]">
                    <StreamingContent content={thinkingContent} isClosing={isStreamingClosing} />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          <ControlBar
            isProcessing={isProcessing}
            isDisabled={!connected}
            onSendText={handleSendMessage}
            onStop={handleStop}
            onVoiceInput={handleVoiceInput}
            voiceSupported={voiceSupported}
            messageHistory={userMessageHistory}
          />
        </div>
      )}

      {/* Listening overlay - shown during voice input or model loading */}
      {(isListening || whisperLoading) && (
        <ListeningOverlay
          interimTranscript={interimTranscript}
          finalTranscript={transcript}
          onCancel={handleCancelVoice}
          onDone={handleDoneVoice}
          isLoadingModel={whisperLoading}
          loadingProgress={whisperProgress}
          silenceProgress={silenceProgress}
          hasSpeechStarted={hasSpeechStarted}
        />
      )}

      {/* Security confirmation modal - shown when a high-risk tool needs user approval */}
      {pendingConfirmation && (
        <SecurityConfirmModal
          isOpen={true}
          confirmation={pendingConfirmation}
          onConfirm={handleConfirmTool}
          onCancel={handleDenyTool}
        />
      )}
    </div>
  );
}
