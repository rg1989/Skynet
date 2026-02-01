/**
 * Wake word audio streaming hook.
 * Captures microphone audio and sends it to the backend for wake word detection.
 */

import { useCallback, useRef, useEffect } from 'react';

interface UseWakeWordOptions {
  enabled: boolean;
  onAudioChunk: (data: ArrayBuffer) => void;
}

export function useWakeWord({ enabled, onAudioChunk }: UseWakeWordOptions) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isStreamingRef = useRef(false);

  /**
   * Start audio streaming for wake word detection.
   */
  const startStreaming = useCallback(async (): Promise<boolean> => {
    if (isStreamingRef.current) {
      return true;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessorNode for audio processing
      // Buffer size of 4096 gives us ~256ms chunks at 16kHz
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        onAudioChunk(pcmData.buffer);
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      isStreamingRef.current = true;
      console.log('[WakeWord] Started audio streaming');
      return true;
    } catch (error) {
      console.error('[WakeWord] Failed to start audio stream:', error);
      return false;
    }
  }, [onAudioChunk]);

  /**
   * Stop audio streaming.
   */
  const stopStreaming = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    isStreamingRef.current = false;
    console.log('[WakeWord] Stopped audio streaming');
  }, []);

  /**
   * Check if streaming is active.
   */
  const isStreaming = useCallback(() => {
    return isStreamingRef.current;
  }, []);

  // Auto-start/stop based on enabled state
  useEffect(() => {
    if (enabled) {
      startStreaming();
    } else {
      stopStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [enabled, startStreaming, stopStreaming]);

  return {
    startStreaming,
    stopStreaming,
    isStreaming,
  };
}
