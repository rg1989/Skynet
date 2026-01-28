import { platform } from 'os';
import type { Platform, RecordingHandle, ScreenRegion } from '../types/index.js';

/**
 * Platform detection and hardware abstraction
 */

export function detectPlatform(): Platform {
  const p = platform();
  if (p === 'darwin' || p === 'linux' || p === 'win32') {
    return p;
  }
  // Default to linux for unknown platforms
  console.warn(`Unknown platform: ${p}, defaulting to linux`);
  return 'linux';
}

/**
 * Hardware adapter interface
 */
export interface HardwareAdapter {
  // Screen capture
  captureScreen(outputPath: string, region?: ScreenRegion): Promise<void>;
  
  // Camera capture
  captureWebcam(outputPath: string): Promise<void>;
  
  // Microphone
  startRecording(outputPath: string): Promise<RecordingHandle>;
  stopRecording(handle: RecordingHandle): Promise<void>;
  
  // Speaker/Audio playback
  playAudio(filePath: string): Promise<void>;
  
  // Text-to-speech
  speak(text: string, voice?: string): Promise<void>;
  
  // Check available capabilities
  checkCapabilities(): Promise<HardwareCapabilities>;
}

export interface HardwareCapabilities {
  screenshot: boolean;
  webcam: boolean;
  microphone: boolean;
  speaker: boolean;
  tts: boolean;
}

/**
 * Get the appropriate hardware adapter for the current platform
 */
export async function createHardwareAdapter(
  platform: Platform,
  overrides?: {
    screenshot?: string;
    webcam?: string;
    microphone?: string;
    speaker?: string;
    tts?: string;
  }
): Promise<HardwareAdapter> {
  switch (platform) {
    case 'darwin':
      const { MacOSAdapter } = await import('./adapters/macos.js');
      return new MacOSAdapter(overrides);
    case 'linux':
      const { LinuxAdapter } = await import('./adapters/linux.js');
      return new LinuxAdapter(overrides);
    case 'win32':
      const { WindowsAdapter } = await import('./adapters/windows.js');
      return new WindowsAdapter(overrides);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
