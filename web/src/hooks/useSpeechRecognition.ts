import { useState, useEffect, useCallback, useRef } from 'react';

// Extend Window interface for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechend?: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  cancelListening: () => void;
}

/**
 * Custom hook for Web Speech API speech recognition
 * Auto-restarts if recognition ends unexpectedly (browser timeout)
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStoppingRef = useRef(false); // User intentionally stopping
  const shouldBeListeningRef = useRef(false); // Should we be listening?
  const hasSpokenRef = useRef(false); // Has user spoken anything?
  
  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  // Initialize recognition instance
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended, shouldBeListening:', shouldBeListeningRef.current, 'isStopping:', isStoppingRef.current);
      
      // If we should still be listening and user didn't stop, auto-restart
      // This handles browser timeouts when no speech is detected
      if (shouldBeListeningRef.current && !isStoppingRef.current) {
        console.log('[SpeechRecognition] Auto-restarting...');
        try {
          // Small delay before restarting to avoid rapid restarts
          setTimeout(() => {
            if (shouldBeListeningRef.current && !isStoppingRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        } catch (err) {
          console.warn('[SpeechRecognition] Auto-restart failed:', err);
          setIsListening(false);
          shouldBeListeningRef.current = false;
        }
      } else {
        setIsListening(false);
        if (isStoppingRef.current) {
          setInterimTranscript('');
        }
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          hasSpokenRef.current = true;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(currentInterim);
    };

    // When user stops speaking, finalize
    recognition.onspeechend = () => {
      console.log('[SpeechRecognition] Speech ended');
      // If user has spoken, stop listening
      if (hasSpokenRef.current) {
        isStoppingRef.current = true;
        shouldBeListeningRef.current = false;
        recognition.stop();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechRecognition] Error:', event.error);
      
      // Don't treat 'aborted' or 'no-speech' as fatal errors
      if (event.error === 'aborted') {
        return;
      }
      
      // 'no-speech' just means timeout, let onend handle restart
      if (event.error === 'no-speech') {
        return;
      }
      
      // For other errors, stop completely
      setError(event.error);
      setIsListening(false);
      shouldBeListeningRef.current = false;
      isStoppingRef.current = true;
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      isStoppingRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (shouldBeListeningRef.current) return; // Already listening
    
    console.log('[SpeechRecognition] Starting...');
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    isStoppingRef.current = false;
    shouldBeListeningRef.current = true;
    hasSpokenRef.current = false;
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[SpeechRecognition] Start error:', err);
      shouldBeListeningRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    console.log('[SpeechRecognition] Stopping...');
    isStoppingRef.current = true;
    shouldBeListeningRef.current = false;
    recognitionRef.current.stop();
  }, []);

  const cancelListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    console.log('[SpeechRecognition] Cancelling...');
    isStoppingRef.current = true;
    shouldBeListeningRef.current = false;
    hasSpokenRef.current = false;
    setTranscript('');
    setInterimTranscript('');
    recognitionRef.current.abort();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    cancelListening,
  };
}
