import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

interface WSEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  const {
    setConnected,
    setActiveRunId,
    setThinkingContent,
    appendThinkingContent,
    addActiveTool,
    removeActiveTool,
    clearActiveTools,
  } = useStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        handleEvent(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, [setConnected]);

  const handleEvent = useCallback((event: WSEvent) => {
    const { type, payload } = event;
    const p = payload as Record<string, unknown>;

    switch (type) {
      case 'agent:start':
        setActiveRunId(p.runId as string);
        setThinkingContent('');
        clearActiveTools();
        break;

      case 'agent:thinking':
        appendThinkingContent(p.content as string);
        break;

      case 'agent:token':
        appendThinkingContent(p.delta as string);
        break;

      case 'agent:tool_start':
        addActiveTool(p.name as string, p.params);
        break;

      case 'agent:tool_end':
        removeActiveTool(p.name as string);
        break;

      case 'agent:end':
        setActiveRunId(null);
        clearActiveTools();
        break;

      default:
        console.log('Unhandled event:', type, payload);
    }
  }, [
    setActiveRunId,
    setThinkingContent,
    appendThinkingContent,
    addActiveTool,
    removeActiveTool,
    clearActiveTools,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  }, []);

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { sendMessage };
}
