import { execa } from 'execa';
import type { HardwareAdapter, HardwareCapabilities } from '../platform.js';
import type { RecordingHandle, ScreenRegion } from '../../types/index.js';

/**
 * macOS hardware adapter
 * Uses: screencapture, ffmpeg/imagesnap, sox, afplay, say
 */

export class MacOSAdapter implements HardwareAdapter {
  private overrides: Record<string, string | undefined>;
  private recordingProcesses: Map<number, ReturnType<typeof execa>> = new Map();

  constructor(overrides?: Record<string, string | undefined>) {
    this.overrides = overrides || {};
  }

  async captureScreen(outputPath: string, region?: ScreenRegion): Promise<void> {
    const cmd = this.overrides.screenshot;
    
    if (cmd) {
      await execa(cmd, [outputPath], { shell: true });
    } else {
      // Use built-in screencapture
      const args = region
        ? ['-R', `${region.x},${region.y},${region.width},${region.height}`, outputPath]
        : ['-x', outputPath]; // -x for silent (no sound)
      await execa('screencapture', args);
    }
  }

  async captureWebcam(outputPath: string): Promise<void> {
    const cmd = this.overrides.webcam;
    
    if (cmd) {
      await execa(cmd, [outputPath], { shell: true });
    } else {
      // Try imagesnap first (simpler), fall back to ffmpeg
      try {
        await execa('imagesnap', ['-q', outputPath], { timeout: 10000 });
      } catch {
        // Use ffmpeg with AVFoundation
        await execa('ffmpeg', [
          '-y',
          '-f', 'avfoundation',
          '-framerate', '30',
          '-i', '0',
          '-frames:v', '1',
          outputPath,
        ], { timeout: 10000 });
      }
    }
  }

  async startRecording(outputPath: string): Promise<RecordingHandle> {
    const cmd = this.overrides.microphone;
    
    let process;
    if (cmd) {
      process = execa(cmd, [outputPath], { shell: true });
    } else {
      // Use sox (rec command)
      process = execa('rec', [outputPath]);
    }

    const pid = process.pid!;
    this.recordingProcesses.set(pid, process);

    return { pid, outputPath };
  }

  async stopRecording(handle: RecordingHandle): Promise<void> {
    const process = this.recordingProcesses.get(handle.pid);
    if (process) {
      process.kill('SIGTERM');
      this.recordingProcesses.delete(handle.pid);
    } else {
      try {
        await execa('kill', ['-TERM', String(handle.pid)]);
      } catch {
        // Process may have already exited
      }
    }
  }

  async playAudio(filePath: string): Promise<void> {
    const cmd = this.overrides.speaker;
    
    if (cmd) {
      await execa(cmd, [filePath], { shell: true });
    } else {
      // Use built-in afplay
      await execa('afplay', [filePath]);
    }
  }

  async speak(text: string, voice?: string): Promise<void> {
    const cmd = this.overrides.tts;
    
    if (cmd) {
      await execa(cmd, { input: text, shell: true });
    } else {
      // Use built-in say command
      const args = voice ? ['-v', voice, text] : [text];
      await execa('say', args);
    }
  }

  async checkCapabilities(): Promise<HardwareCapabilities> {
    const check = async (cmd: string): Promise<boolean> => {
      try {
        await execa('which', [cmd]);
        return true;
      } catch {
        return false;
      }
    };

    return {
      screenshot: true, // screencapture is always available on macOS
      webcam: await check('imagesnap') || await check('ffmpeg'),
      microphone: await check('rec') || await check('sox'),
      speaker: true, // afplay is always available on macOS
      tts: true, // say is always available on macOS
    };
  }
}
