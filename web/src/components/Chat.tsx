import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore, type Message, type SessionInfo } from '../store';
import { ChatMessage } from './ChatMessage';
import { ChatHeader } from './ChatHeader';
import { ControlBar } from './ControlBar';
import { SessionSidebar } from './SessionSidebar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { TranscribingIndicator } from './TranscribingIndicator';
import { ListeningOverlay } from './ListeningOverlay';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  
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
    clearActiveTools,
    currentSessionKey,
    setCurrentSession,
    setSessions,
    isListening,
    setIsListening,
    isTranscribing,
    setIsTranscribing,
  } = useStore();

  // Speech recognition hook
  const {
    isListening: speechIsListening,
    transcript,
    interimTranscript,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    cancelListening,
  } = useSpeechRecognition();

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

  // Load session history when session changes
  const loadSessionHistory = useCallback(async (sessionKey: string) => {
    if (!sessionKey) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionKey}`);
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        // Convert backend messages to frontend format
        const formattedMessages: Message[] = data.messages.map((msg: { role: string; content: string; timestamp: number }, index: number) => ({
          id: `msg_${msg.timestamp}_${index}`,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp,
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionKey: currentSessionKey,
        }),
      });

      const data = await response.json();
      
      // Clear thinking/streaming state and add the final response
      setIsThinking(false);
      setThinkingContent('');
      setActiveRunId(null);
      
      if (data.response) {
        addMessage({
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
        });
        
        // Refresh sessions list to update message counts
        refreshSessions();
      } else if (data.error) {
        addMessage({
          id: `msg_${Date.now()}`,
          role: 'system',
          content: `Error: ${data.error}`,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false);
      setThinkingContent('');
      setActiveRunId(null);
      addMessage({
        id: `msg_${Date.now()}`,
        role: 'system',
        content: 'Failed to send message. Please check your connection.',
        timestamp: Date.now(),
      });
    }
  }, [addMessage, setIsThinking, setThinkingContent, setActiveRunId, currentSessionKey, refreshSessions]);

  const handleStop = useCallback(() => {
    // TODO: Implement cancel via API
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
    
    const finalText = (transcript + interimTranscript).trim();
    if (finalText) {
      setIsTranscribing(true);
      setTimeout(() => {
        setIsTranscribing(false);
        handleSendMessage(finalText);
      }, 500);
    }
  }, [stopListening, setIsListening, transcript, interimTranscript, setIsTranscribing, handleSendMessage]);

  const isProcessing = activeRunId !== null || isThinking || thinkingContent.length > 0 || isTranscribing;

  return (
    <div className="flex h-full bg-[#15181c]">
      {/* Session sidebar */}
      <SessionSidebar onSessionChange={handleSessionChange} />

      {/* Main chat area */}
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
            
            {/* Transcribing indicator - shown while processing voice input */}
            {isTranscribing && <TranscribingIndicator />}
            
            {/* Thinking indicator - shown while waiting for first token */}
            {isThinking && !thinkingContent && <ThinkingIndicator />}
            
            {/* Streaming content - shown when tokens start arriving */}
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
        </div>

        <ControlBar
          isProcessing={isProcessing}
          isDisabled={!connected}
          onSendText={handleSendMessage}
          onStop={handleStop}
          onVoiceInput={handleVoiceInput}
          voiceSupported={voiceSupported}
        />
      </div>

      {/* Listening overlay - shown during voice input */}
      {isListening && (
        <ListeningOverlay
          interimTranscript={interimTranscript}
          finalTranscript={transcript}
          onCancel={handleCancelVoice}
          onDone={handleDoneVoice}
        />
      )}
    </div>
  );
}
