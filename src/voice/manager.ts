/**
 * Voice Service Manager
 * 
 * Manages the Python voice service subprocess for TTS and wake word detection.
 */

import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import WebSocket from 'ws';

export interface VoiceSettings {
  tts: {
    enabled: boolean;
    muted: boolean;
    voice: string;
    speed: number;
    voices?: Record<string, string>;
  };
  wakeword: {
    enabled: boolean;
    model: string;
    threshold: number;
    timeoutSeconds: number;
    ready?: boolean;
  };
}

type MessageHandler = (type: string, payload: unknown) => void;

export class VoiceServiceManager {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private wsConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandler: MessageHandler | null = null;
  
  private readonly voiceDir: string;
  private readonly venvPython: string;
  private readonly port: number;
  
  private settings: VoiceSettings = {
    tts: {
      enabled: true,
      muted: false,
      voice: 'af_heart',
      speed: 1.1,
    },
    wakeword: {
      enabled: false,
      model: 'hey_jarvis',
      threshold: 0.5,
      timeoutSeconds: 10,
    },
  };

  constructor(port: number = 4202) {
    this.port = port;
    this.voiceDir = join(process.cwd(), 'voice');
    this.venvPython = join(this.voiceDir, 'venv', 'bin', 'python');
  }

  /**
   * Check if the voice service is available (venv exists).
   */
  isAvailable(): boolean {
    const serverModule = join(this.voiceDir, 'src', 'server.py');
    return existsSync(this.venvPython) && existsSync(serverModule);
  }

  /**
   * Start the voice service subprocess.
   */
  async start(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('[Voice] Voice service not set up. To enable:');
      console.log('  cd voice && python3 -m venv venv && source venv/bin/activate && pip install -e .');
      return false;
    }

    if (this.process) {
      console.log('[Voice] Service already running');
      return true;
    }

    return new Promise((resolve) => {
      try {
        // Spawn Python voice service
        this.process = spawn(this.venvPython, ['-m', 'src.server'], {
          cwd: this.voiceDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: {
            ...process.env,
            VOICE_PORT: String(this.port),
          },
        });

        let startupComplete = false;

        this.process.stdout?.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg) {
            console.log(`[Voice] ${msg}`);
            // Check for startup complete
            if (msg.includes('Uvicorn running') || msg.includes('Application startup complete')) {
              if (!startupComplete) {
                startupComplete = true;
                // Connect WebSocket after service is ready
                setTimeout(() => {
                  this.connectWebSocket().then(() => resolve(true));
                }, 500);
              }
            }
          }
        });

        this.process.stderr?.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg && !msg.includes('Started server process') && !msg.includes('Waiting for application')) {
            // Uvicorn logs to stderr, so check for startup message here too
            if (msg.includes('Uvicorn running') || msg.includes('Application startup complete')) {
              if (!startupComplete) {
                startupComplete = true;
                setTimeout(() => {
                  this.connectWebSocket().then(() => resolve(true));
                }, 500);
              }
            } else if (msg.includes('INFO:')) {
              console.log(`[Voice] ${msg}`);
            } else {
              console.error(`[Voice] ${msg}`);
            }
          }
        });

        this.process.on('error', (err) => {
          console.error('[Voice] Failed to start service:', err.message);
          this.process = null;
          resolve(false);
        });

        this.process.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`[Voice] Service exited with code ${code}`);
          }
          this.process = null;
          this.ws = null;
          if (!startupComplete) {
            resolve(false);
          }
        });

        // Timeout for startup
        setTimeout(() => {
          if (!startupComplete) {
            console.log('[Voice] Service startup timeout, attempting WebSocket connection...');
            this.connectWebSocket().then(() => resolve(true)).catch(() => resolve(false));
          }
        }, 10000);

      } catch (error) {
        console.error('[Voice] Failed to start service:', error);
        resolve(false);
      }
    });
  }

  /**
   * Connect to the voice service WebSocket.
   */
  private async connectWebSocket(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.wsConnecting) {
      return;
    }

    this.wsConnecting = true;

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://127.0.0.1:${this.port}/ws`;
      console.log(`[Voice] Connecting to ${wsUrl}...`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[Voice] WebSocket connected');
        this.wsConnecting = false;
        
        // Request initial settings
        this.send({ type: 'get_settings' });
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[Voice] Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('[Voice] WebSocket disconnected');
        this.ws = null;
        this.wsConnecting = false;
        
        // Auto-reconnect if process is still running
        if (this.process) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Voice] WebSocket error:', err.message);
        this.wsConnecting = false;
        reject(err);
      });
    });
  }

  /**
   * Schedule WebSocket reconnection.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.process && !this.ws) {
        this.connectWebSocket().catch(() => {
          // Will retry on next schedule
        });
      }
    }, 3000);
  }

  /**
   * Handle incoming message from voice service.
   */
  private handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string;

    switch (type) {
      case 'connected':
        console.log('[Voice] Session established');
        break;

      case 'settings':
        // Update local settings cache
        if (message.tts) {
          this.settings.tts = message.tts as VoiceSettings['tts'];
        }
        if (message.wakeword) {
          this.settings.wakeword = message.wakeword as VoiceSettings['wakeword'];
        }
        break;

      case 'voices':
        if (message.voices) {
          this.settings.tts.voices = message.voices as Record<string, string>;
        }
        break;

      case 'wakeword_settings':
        this.settings.wakeword = message as unknown as VoiceSettings['wakeword'];
        break;
    }

    // Forward to message handler
    if (this.messageHandler) {
      this.messageHandler(`voice:${type}`, message);
    }
  }

  /**
   * Send message to voice service.
   */
  send(message: Record<string, unknown>): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Send binary audio data to voice service.
   */
  sendAudio(audioData: Buffer): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
      return true;
    }
    return false;
  }

  /**
   * Set message handler for incoming events.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Synthesize text to speech.
   */
  synthesize(text: string, messageId: string, isFinal: boolean = false): void {
    this.send({
      type: 'synthesize',
      text,
      messageId,
      isFinal,
    });
  }

  /**
   * Set TTS enabled state.
   */
  setTtsEnabled(enabled: boolean): void {
    this.settings.tts.enabled = enabled;
    this.send({ type: 'set_tts_enabled', enabled });
  }

  /**
   * Set TTS muted state.
   */
  setTtsMuted(muted: boolean): void {
    this.settings.tts.muted = muted;
    this.send({ type: 'set_tts_muted', muted });
  }

  /**
   * Set TTS voice.
   */
  setVoice(voice: string): void {
    this.settings.tts.voice = voice;
    this.send({ type: 'set_voice', voice });
  }

  /**
   * Set TTS speed.
   */
  setSpeed(speed: number): void {
    this.settings.tts.speed = speed;
    this.send({ type: 'set_speed', speed });
  }

  /**
   * Update wake word settings.
   */
  setWakewordSettings(settings: Partial<VoiceSettings['wakeword']>): void {
    Object.assign(this.settings.wakeword, settings);
    this.send({
      type: 'set_wakeword_settings',
      ...settings,
    });
  }

  /**
   * Stop current TTS playback.
   */
  stopSpeaking(): void {
    this.send({ type: 'stop_speaking' });
  }

  /**
   * Set processing state (prevents wake word timeout).
   */
  setProcessing(processing: boolean): void {
    this.send({ type: 'set_processing', processing });
  }

  /**
   * Return to listening state after response.
   */
  setListening(): void {
    this.send({ type: 'set_listening' });
  }

  /**
   * Get current settings.
   */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  /**
   * Check if service is running.
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Check if WebSocket is connected.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Stop the voice service.
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.process) {
      console.log('[Voice] Stopping service...');
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

// Singleton instance
let voiceManager: VoiceServiceManager | null = null;

export function getVoiceManager(): VoiceServiceManager {
  if (!voiceManager) {
    voiceManager = new VoiceServiceManager();
  }
  return voiceManager;
}
