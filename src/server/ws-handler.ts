import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { WSEvent, WSEventType, ToolConfirmationResponse } from '../types/index.js';
import type { AgentRunner } from '../agent/runner.js';
import type { VoiceServiceManager } from '../voice/manager.js';

/**
 * WebSocket handler for real-time communication with clients
 */

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  connectedAt: number;
  pingInterval?: NodeJS.Timeout;
  isAlive: boolean;
}

// Agent runner instance (set during initialization)
let agentRunner: AgentRunner | null = null;

// Voice service manager instance
let voiceManager: VoiceServiceManager | null = null;

/**
 * Set the agent runner instance for handling confirmation responses
 */
export function setAgentRunner(runner: AgentRunner): void {
  agentRunner = runner;
}

/**
 * Set the voice manager instance for handling voice events
 */
export function setVoiceManager(manager: VoiceServiceManager): void {
  voiceManager = manager;
}

export class WSHandler {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private clientIdCounter = 0;

  constructor(server: Server) {
    // Use path /ws for WebSocket connections (works with Vite proxy in dev)
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
      const clientId = `client_${++this.clientIdCounter}`;
      const client: ConnectedClient = {
        id: clientId,
        ws,
        connectedAt: Date.now(),
        isAlive: true,
      };
      
      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

      // Send welcome message
      this.sendTo(clientId, 'agent:end', { 
        status: 'connected',
        clientId,
        message: 'Connected to Skynet',
      });

      // Handle pong responses to keep connection alive
      ws.on('pong', () => {
        client.isAlive = true;
      });

      // Set up ping interval to keep connection alive and detect dead connections
      // Ping every 30 seconds
      client.pingInterval = setInterval(() => {
        if (!client.isAlive) {
          // Connection is dead, terminate it
          console.log(`WebSocket client ${clientId} not responding to pings, terminating`);
          clearInterval(client.pingInterval);
          ws.terminate();
          return;
        }
        
        client.isAlive = false;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (data: RawData, isBinary: boolean) => {
        if (isBinary) {
          // Binary audio data for wake word detection
          this.handleAudioData(clientId, data as Buffer);
        } else {
          this.handleMessage(clientId, data.toString());
        }
      });

      ws.on('close', () => {
        if (client.pingInterval) {
          clearInterval(client.pingInterval);
        }
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        if (client.pingInterval) {
          clearInterval(client.pingInterval);
        }
        this.clients.delete(clientId);
      });
    });
  }

  private handleMessage(clientId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      console.log(`Message from ${clientId}:`, message);
      
      // Handle different message types from clients
      switch (message.type) {
        case 'ping':
          this.sendTo(clientId, 'agent:end', { type: 'pong', timestamp: Date.now() });
          break;
        case 'subscribe':
          // Could implement topic subscriptions here
          break;
        case 'confirm_response':
          // Handle tool confirmation response from UI
          if (agentRunner && message.payload) {
            const response = message.payload as ToolConfirmationResponse;
            const handled = agentRunner.handleConfirmationResponse(response);
            if (!handled) {
              console.warn(`Confirmation response not handled: ${response.confirmId}`);
            }
          }
          break;
        
        // Voice-related messages
        case 'voice:set_tts_muted':
          if (voiceManager) {
            voiceManager.setTtsMuted(message.payload?.muted ?? false);
          }
          break;
        case 'voice:set_tts_enabled':
          if (voiceManager) {
            voiceManager.setTtsEnabled(message.payload?.enabled ?? true);
          }
          break;
        case 'voice:set_voice':
          if (voiceManager && message.payload?.voice) {
            voiceManager.setVoice(message.payload.voice);
          }
          break;
        case 'voice:set_speed':
          if (voiceManager && message.payload?.speed) {
            voiceManager.setSpeed(message.payload.speed);
          }
          break;
        case 'voice:set_wakeword':
          if (voiceManager && message.payload) {
            voiceManager.setWakewordSettings(message.payload);
          }
          break;
        case 'voice:stop_speaking':
          if (voiceManager) {
            voiceManager.stopSpeaking();
          }
          break;
        case 'voice:get_settings':
          if (voiceManager) {
            this.sendTo(clientId, 'voice:settings', voiceManager.getSettings());
          }
          break;
        default:
          // Unknown message type
          break;
      }
    } catch (error) {
      console.error(`Failed to parse message from ${clientId}:`, error);
    }
  }

  /**
   * Handle binary audio data for wake word detection.
   */
  private handleAudioData(_clientId: string, data: Buffer): void {
    if (voiceManager && voiceManager.isConnected()) {
      voiceManager.sendAudio(data);
    }
  }

  /**
   * Send event to a specific client
   */
  sendTo(clientId: string, type: WSEventType, payload: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const event: WSEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    try {
      client.ws.send(JSON.stringify(event));
      return true;
    } catch (error) {
      console.error(`Failed to send to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(type: WSEventType, payload: unknown): number {
    const event: WSEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const message = JSON.stringify(event);

    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sent++;
        } catch (error) {
          console.error(`Failed to broadcast to ${client.id}:`, error);
        }
      }
    }
    return sent;
  }

  /**
   * Get count of connected clients
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const client of this.clients.values()) {
      if (client.pingInterval) {
        clearInterval(client.pingInterval);
      }
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    this.wss.close();
  }
}
