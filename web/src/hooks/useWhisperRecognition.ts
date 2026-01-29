import { useState, useCallback, useRef, useEffect } from 'react';

// Dynamic import for transformers.js to enable code splitting
let pipeline: typeof import('@huggingface/transformers').pipeline | null = null;

interface WhisperRecognitionReturn {
  isListening: boolean;
  isLoading: boolean;
  loadingProgress: number;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  cancelListening: () => void;
}

/**
 * Custom hook for local Whisper-based speech recognition
 * Uses @huggingface/transformers to run Whisper model in the browser
 * No API key or network required after model is cached
 */
export function useWhisperRecognition(): WhisperRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transciberRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wasCancelledRef = useRef(false);
  
  // Check browser support
  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 
      !!navigator.mediaDevices && 
      !!navigator.mediaDevices.getUserMedia;
    setIsSupported(supported);
  }, []);

  // Load the Whisper model
  const loadModel = useCallback(async () => {
    if (transciberRef.current) return transciberRef.current;
    
    setIsLoading(true);
    setLoadingProgress(0);
    
    try {
      // Dynamically import transformers.js
      if (!pipeline) {
        console.log('[Whisper] Loading transformers.js...');
        const transformers = await import('@huggingface/transformers');
        pipeline = transformers.pipeline;
      }
      
      console.log('[Whisper] Loading Whisper model (this may take a moment on first run)...');
      
      // Use whisper-tiny.en for faster loading and inference (English-only)
      // Model is cached by the browser after first download
      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        {
          progress_callback: (progress: { progress?: number; status?: string }) => {
            if (progress.progress !== undefined) {
              setLoadingProgress(Math.round(progress.progress));
              console.log(`[Whisper] Loading: ${Math.round(progress.progress)}%`);
            }
          },
        }
      );
      
      transciberRef.current = transcriber;
      setIsLoading(false);
      setLoadingProgress(100);
      console.log('[Whisper] Model loaded successfully');
      
      return transcriber;
    } catch (err) {
      console.error('[Whisper] Failed to load model:', err);
      setError('Failed to load speech recognition model');
      setIsLoading(false);
      throw err;
    }
  }, []);

  // Process recorded audio with Whisper
  const processAudio = useCallback(async (audioBlob: Blob) => {
    // Skip if cancelled or blob is too small (less than 1KB = likely no audio)
    if (wasCancelledRef.current) {
      console.log('[Whisper] Skipping processing - was cancelled');
      setInterimTranscript('');
      return;
    }
    
    if (audioBlob.size < 1000) {
      console.log('[Whisper] No audio captured (blob size:', audioBlob.size, ')');
      setInterimTranscript('');
      // Don't show error - just silently return since no audio was captured
      return;
    }
    
    try {
      setInterimTranscript('Processing...');
      
      const transcriber = await loadModel();
      if (!transcriber) {
        setInterimTranscript('');
        return;
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio to get raw audio data
      let audioContext: AudioContext | null = null;
      try {
        audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get audio data as Float32Array (mono)
        const audioData = audioBuffer.getChannelData(0);
        
        // Check if audio is too short (less than 0.5 seconds at 16kHz)
        if (audioData.length < 8000) {
          console.log('[Whisper] Audio too short:', audioData.length, 'samples');
          setInterimTranscript('');
          await audioContext.close();
          return;
        }
        
        console.log('[Whisper] Processing audio...', audioData.length, 'samples');
        
        // Run transcription
        const result = await (transcriber as (audio: Float32Array) => Promise<{ text: string }>)(audioData);
        
        console.log('[Whisper] Transcription result:', result);
        
        const text = result.text?.trim() || '';
        if (text) {
          setTranscript(text);
        }
        setInterimTranscript('');
        
        await audioContext.close();
      } catch (decodeErr) {
        // Audio decode error - likely empty or corrupted audio, not a real error
        console.log('[Whisper] Could not decode audio:', decodeErr);
        setInterimTranscript('');
        if (audioContext) {
          await audioContext.close();
        }
      }
    } catch (err) {
      console.error('[Whisper] Processing error:', err);
      setError('Failed to process audio');
      setInterimTranscript('');
    }
  }, [loadModel]);

  const startListening = useCallback(async () => {
    if (isListening) return;
    
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    audioChunksRef.current = [];
    wasCancelledRef.current = false;
    
    try {
      // Pre-load model if not loaded
      if (!transciberRef.current) {
        await loadModel();
      }
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        } 
      });
      streamRef.current = stream;
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudio(audioBlob);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsListening(true);
      setInterimTranscript('Listening...');
      console.log('[Whisper] Recording started');
      
    } catch (err) {
      console.error('[Whisper] Failed to start recording:', err);
      setError('Microphone access denied');
    }
  }, [isListening, loadModel, processAudio]);

  const stopListening = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    console.log('[Whisper] Stopping recording...');
    setIsListening(false);
    
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cancelListening = useCallback(() => {
    console.log('[Whisper] Cancelling...');
    
    // Set cancelled flag BEFORE stopping so onstop handler knows to skip processing
    wasCancelledRef.current = true;
    
    setIsListening(false);
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    audioChunksRef.current = [];
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  return {
    isListening,
    isLoading,
    loadingProgress,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    cancelListening,
  };
}
