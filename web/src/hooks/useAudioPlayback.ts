/**
 * Audio playback hook for TTS audio segments.
 * Plays base64-encoded Int16 PCM audio received from the voice service.
 */

import { useCallback, useRef } from 'react';

interface QueuedAudio {
  base64Audio: string;
  sampleRate: number;
  messageId?: string;
}

interface UseAudioPlaybackOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}) {
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<QueuedAudio[]>([]);
  const isPlayingRef = useRef(false);
  const currentMessageIdRef = useRef<string | null>(null);

  /**
   * Play a single audio segment.
   */
  const playAudioSegment = useCallback(
    async (base64Audio: string, sampleRate: number): Promise<void> => {
      try {
        // Create or reuse playback context
        if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
          playbackContextRef.current = new AudioContext({ sampleRate });
        }

        const context = playbackContextRef.current;

        // Resume context if suspended (browser autoplay policy)
        if (context.state === 'suspended') {
          await context.resume();
        }

        // Decode base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert Int16 to Float32
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768;
        }

        // Create audio buffer
        const audioBuffer = context.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.getChannelData(0).set(float32Array);

        // Play the audio
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start();

        // Return a promise that resolves when playback ends
        return new Promise<void>((resolve) => {
          source.onended = () => resolve();
        });
      } catch (error) {
        console.error('Failed to play audio:', error);
      }
    },
    []
  );

  /**
   * Process the audio queue sequentially.
   */
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) return;

    isPlayingRef.current = true;
    options.onPlaybackStart?.();

    while (audioQueueRef.current.length > 0) {
      const segment = audioQueueRef.current.shift();
      if (segment) {
        await playAudioSegment(segment.base64Audio, segment.sampleRate);
      }
    }

    isPlayingRef.current = false;
    options.onPlaybackEnd?.();
  }, [playAudioSegment, options]);

  /**
   * Queue audio for playback.
   */
  const playAudio = useCallback(
    (base64Audio: string, sampleRate: number, messageId?: string) => {
      // Track current message
      if (messageId) {
        currentMessageIdRef.current = messageId;
      }

      audioQueueRef.current.push({ base64Audio, sampleRate, messageId });
      processAudioQueue();
    },
    [processAudioQueue]
  );

  /**
   * Clear the audio queue and stop playback.
   */
  const stopPlayback = useCallback(() => {
    audioQueueRef.current = [];
    currentMessageIdRef.current = null;

    // Close context to stop any currently playing audio
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  /**
   * Check if currently playing.
   */
  const isPlaying = useCallback(() => {
    return isPlayingRef.current;
  }, []);

  /**
   * Cleanup resources.
   */
  const cleanup = useCallback(() => {
    stopPlayback();
  }, [stopPlayback]);

  return {
    playAudio,
    stopPlayback,
    isPlaying,
    cleanup,
  };
}
