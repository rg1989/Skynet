import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { WSEvent, WSEventType } from '../types/index.js';

/**
 * WebSocket handler for real-time communication with clients
 */

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  connectedAt: number;
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
    this.wss.on('connection', (ws, _req) => {
      const clientId = `client_${++this.clientIdCounter}`;
      const client: ConnectedClient = {
        id: clientId,
        ws,
        connectedAt: Date.now(),
      };
      
      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

      // Send welcome message
      this.sendTo(clientId, 'agent:end', { 
        status: 'connected',
        clientId,
        message: 'Connected to Skynet',
      });

      ws.on('message', (data) => {
        this.handleMessage(clientId, data.toString());
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
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
        default:
          // Unknown message type
          break;
      }
    } catch (error) {
      console.error(`Failed to parse message from ${clientId}:`, error);
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
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    this.wss.close();
  }
}
