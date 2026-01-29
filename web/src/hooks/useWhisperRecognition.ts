import { useState, useCallback, useRef, useEffect } from 'react';

// Dynamic import for transformers.js to enable code splitting
let pipeline: typeof import('@huggingface/transformers').pipeline | null = null;

// Silence detection configuration
const SILENCE_THRESHOLD = 0.06; // Audio level below this is considered silence (higher = less sensitive to breathing)
const SILENCE_TIMEOUT_MS = 2000; // Auto-send after 2 seconds of silence
const AUDIO_CHECK_INTERVAL_MS = 50; // Check audio level every 50ms

interface WhisperRecognitionReturn {
  isListening: boolean;
  isLoading: boolean;
  isTranscribing: boolean; // Whether Whisper is actively processing audio
  loadingProgress: number;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  silenceProgress: number; // 0-1, where 1 = full silence timeout reached
  hasSpeechStarted: boolean; // Whether user has started speaking at all
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [silenceProgress, setSilenceProgress] = useState(0); // 0-1
  const [hasSpeechStarted, setHasSpeechStarted] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transciberRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wasCancelledRef = useRef(false);
  
  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const audioCheckIntervalRef = useRef<number | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  
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
      setIsTranscribing(false);
      return;
    }
    
    if (audioBlob.size < 1000) {
      console.log('[Whisper] No audio captured (blob size:', audioBlob.size, ')');
      setInterimTranscript('');
      setIsTranscribing(false);
      // Don't show error - just silently return since no audio was captured
      return;
    }
    
    try {
      setIsTranscribing(true);
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
        // Filter out Whisper's blank audio tokens - these should not be sent as messages
        const invalidResponses = ['[BLANK_AUDIO]', '(blank audio)', '[ Silence ]', '[silence]'];
        const isBlankAudio = !text || invalidResponses.some(invalid => 
          text.toLowerCase().includes(invalid.toLowerCase())
        );
        
        if (!isBlankAudio) {
          setTranscript(text);
        } else {
          console.log('[Whisper] Detected blank/silent audio, not setting transcript');
        }
        setInterimTranscript('');
        setIsTranscribing(false);
        
        await audioContext.close();
      } catch (decodeErr) {
        // Audio decode error - likely empty or corrupted audio, not a real error
        console.log('[Whisper] Could not decode audio:', decodeErr);
        setInterimTranscript('');
        setIsTranscribing(false);
        if (audioContext) {
          await audioContext.close();
        }
      }
    } catch (err) {
      console.error('[Whisper] Processing error:', err);
      setError('Failed to process audio');
      setInterimTranscript('');
      setIsTranscribing(false);
    }
  }, [loadModel]);

  // Clean up audio monitoring
  const cleanupAudioMonitoring = useCallback(() => {
    if (audioCheckIntervalRef.current) {
      clearInterval(audioCheckIntervalRef.current);
      audioCheckIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
    setSilenceProgress(0);
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setSilenceProgress(0);
    setHasSpeechStarted(false);
    audioChunksRef.current = [];
    wasCancelledRef.current = false;
    silenceStartRef.current = null;
    
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
      
      // Set up audio analysis for silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
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
      console.log('[Whisper] Recording started with silence detection');
      
      // Start monitoring audio levels for silence detection
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      audioCheckIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average audio level (0-1)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        
        const now = Date.now();
        
        if (average > SILENCE_THRESHOLD) {
          // Sound detected - reset silence timer
          silenceStartRef.current = null;
          setSilenceProgress(0);
          setHasSpeechStarted(true);
        } else {
          // Silence detected
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          }
          
          const silenceDuration = now - silenceStartRef.current;
          const progress = Math.min(silenceDuration / SILENCE_TIMEOUT_MS, 1);
          setSilenceProgress(progress);
          
          // Auto-stop after silence timeout (only if user has spoken at least once)
          if (silenceDuration >= SILENCE_TIMEOUT_MS && stopListeningRef.current) {
            console.log('[Whisper] Silence timeout - auto-stopping');
            stopListeningRef.current();
          }
        }
      }, AUDIO_CHECK_INTERVAL_MS);
      
    } catch (err) {
      console.error('[Whisper] Failed to start recording:', err);
      setError('Microphone access denied');
    }
  }, [isListening, loadModel, processAudio, cleanupAudioMonitoring]);

  const stopListening = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    console.log('[Whisper] Stopping recording...');
    setIsListening(false);
    
    // Clean up audio monitoring
    cleanupAudioMonitoring();
    
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [cleanupAudioMonitoring]);

  // Keep ref updated so interval can call stopListening
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  const cancelListening = useCallback(() => {
    console.log('[Whisper] Cancelling...');
    
    // Set cancelled flag BEFORE stopping so onstop handler knows to skip processing
    wasCancelledRef.current = true;
    
    setIsListening(false);
    setTranscript('');
    setInterimTranscript('');
    setSilenceProgress(0);
    setHasSpeechStarted(false);
    setError(null);
    audioChunksRef.current = [];
    
    // Clean up audio monitoring
    cleanupAudioMonitoring();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [cleanupAudioMonitoring]);

  return {
    isListening,
    isLoading,
    isTranscribing,
    loadingProgress,
    transcript,
    interimTranscript,
    isSupported,
    error,
    silenceProgress,
    hasSpeechStarted,
    startListening,
    stopListening,
    cancelListening,
  };
}
