import { useEffect } from 'react';
import { useStore } from '../store';

interface WSEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

// Voice event callbacks
type VoiceAudioCallback = (audio: string, sampleRate: number, messageId?: string) => void;
type WakeStatusCallback = (state: string, detected?: boolean) => void;

// Singleton WebSocket connection - prevents duplicates from StrictMode or HMR
let globalWs: WebSocket | null = null;
let globalWsConnecting = false;
let reconnectTimeout: number | null = null;
let hasInitialized = false;
let currentRunId: string | null = null;
let accumulatedContent = '';

// Voice event callback registry (module-level to persist across re-renders)
let voiceAudioCallback: VoiceAudioCallback | null = null;
let wakeStatusCallback: WakeStatusCallback | null = null;

/**
 * Register a callback for TTS audio events
 */
export function onVoiceAudio(callback: VoiceAudioCallback | null) {
  voiceAudioCallback = callback;
}

/**
 * Register a callback for wake word status events
 */
export function onWakeStatus(callback: WakeStatusCallback | null) {
  wakeStatusCallback = callback;
}

/**
 * Clears the current run state. Call this when the user clicks Stop
 * to prevent incoming WebSocket events from updating the UI.
 */
export function clearCurrentRun() {
  currentRunId = null;
  accumulatedContent = '';
}

// Handle HMR - close old WebSocket when module is hot-replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('HMR: Disposing old WebSocket connection');
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (globalWs) {
      globalWs.close();
      globalWs = null;
    }
    hasInitialized = false;
    globalWsConnecting = false;
    currentRunId = null;
    accumulatedContent = '';
  });
}

export function useWebSocket() {
  const {
    setConnected,
    setActiveRunId,
    setIsThinking,
    setThinkingContent,
    addActiveTool,
    removeActiveTool,
    clearActiveTools,
    setPendingConfirmation,
  } = useStore();

  useEffect(() => {
    // Only initialize once per app lifetime (module-level flag survives StrictMode remounts)
    if (hasInitialized) {
      return;
    }
    hasInitialized = true;

    const handleEvent = (event: WSEvent) => {
      const { type, payload } = event;
      const p = payload as Record<string, unknown>;

      switch (type) {
        case 'agent:start':
          currentRunId = p.runId as string;
          accumulatedContent = '';
          setActiveRunId(currentRunId);
          setIsThinking(true); // Start thinking state
          setThinkingContent('');
          clearActiveTools();
          break;

        case 'agent:thinking':
          // Only process if we have an active run
          if (currentRunId && p.runId === currentRunId) {
            setIsThinking(false); // No longer just thinking, now streaming
            accumulatedContent += p.content as string;
            setThinkingContent(accumulatedContent);
          }
          break;

        case 'agent:token':
          // Only process if we have an active run
          if (currentRunId && p.runId === currentRunId) {
            setIsThinking(false); // No longer just thinking, now streaming
            accumulatedContent += p.delta as string;
            setThinkingContent(accumulatedContent);
          }
          break;

        case 'agent:tool_start':
          if (currentRunId && p.runId === currentRunId) {
            // Keep isThinking true - we still want to show the thinking indicator
            // until actual content starts streaming. This prevents the gap where
            // nothing is displayed between thinking and streaming.
            addActiveTool(p.name as string, p.params);
          }
          break;

        case 'agent:tool_end':
          if (currentRunId && p.runId === currentRunId) {
            removeActiveTool(p.name as string);
          }
          break;

        case 'agent:end':
          if (currentRunId && p.runId === currentRunId) {
            currentRunId = null;
            accumulatedContent = '';
            setActiveRunId(null);
            setIsThinking(false);
            clearActiveTools();
          }
          break;

        case 'agent:confirm_required': {
          // Handle tool confirmation request for high-risk output tools
          const confirmPayload = p as {
            confirmId: string;
            runId: string;
            toolName: string;
            toolParams: Record<string, unknown>;
            riskReason: string;
          };
          setPendingConfirmation(confirmPayload);
          break;
        }

        // Voice events
        case 'voice:tts_audio':
          if (voiceAudioCallback) {
            voiceAudioCallback(
              p.audio as string,
              p.sampleRate as number,
              p.messageId as string | undefined
            );
          }
          break;

        case 'voice:wake_status':
          if (wakeStatusCallback) {
            wakeStatusCallback(
              p.state as string,
              p.detected as boolean | undefined
            );
          }
          // Also update store
          useStore.getState().setWakeWordStatus(p.state as 'listening' | 'active' | 'disabled');
          break;

        case 'voice:tts_start':
          useStore.getState().setIsTtsSpeaking(true);
          break;

        case 'voice:tts_complete':
          useStore.getState().setIsTtsSpeaking(false);
          break;

        default:
          // Ignore unhandled events
          break;
      }
    };

    const connect = () => {
      // Prevent duplicate connections
      if (globalWs?.readyState === WebSocket.OPEN || globalWsConnecting) {
        return;
      }

      globalWsConnecting = true;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Use /ws path - works in both dev (Vite proxy) and production
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        globalWs = ws;
        globalWsConnecting = false;
        setConnected(true);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        globalWs = null;
        globalWsConnecting = false;
        setConnected(false);
        
        // Reconnect after 3 seconds
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = null;
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        globalWsConnecting = false;
      };

      ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          handleEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    };

    connect();

    // Cleanup on unmount (though this shouldn't happen for App-level hook)
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      // Don't close the WebSocket on cleanup - it's a singleton
      // This prevents StrictMode from breaking the connection
    };
  }, [
    setConnected,
    setActiveRunId,
    setIsThinking,
    setThinkingContent,
    addActiveTool,
    removeActiveTool,
    clearActiveTools,
    setPendingConfirmation,
  ]);

  const sendMessage = (type: string, payload: unknown) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ type, payload }));
    }
  };

  return { sendMessage };
}
