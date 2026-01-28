import { execa } from 'execa';
import { existsSync } from 'fs';
import type { HardwareAdapter, HardwareCapabilities } from '../platform.js';
import type { RecordingHandle, ScreenRegion } from '../../types/index.js';

/**
 * Linux hardware adapter
 * Uses: scrot/gnome-screenshot, ffmpeg, arecord/parecord, aplay/paplay, espeak/festival
 */

export class LinuxAdapter implements HardwareAdapter {
  private overrides: Record<string, string | undefined>;
  private recordingProcesses: Map<number, ReturnType<typeof execa>> = new Map();

  constructor(overrides?: Record<string, string | undefined>) {
    this.overrides = overrides || {};
  }

  async captureScreen(outputPath: string, region?: ScreenRegion): Promise<void> {
    const cmd = this.overrides.screenshot || await this.findScreenshotTool();
    
    if (cmd.includes('scrot')) {
      const args = region 
        ? ['-a', `${region.x},${region.y},${region.width},${region.height}`, outputPath]
        : [outputPath];
      await execa('scrot', args);
    } else if (cmd.includes('gnome-screenshot')) {
      await execa('gnome-screenshot', ['-f', outputPath]);
    } else if (cmd.includes('import')) {
      // ImageMagick's import
      const args = region
        ? ['-window', 'root', '-crop', `${region.width}x${region.height}+${region.x}+${region.y}`, outputPath]
        : ['-window', 'root', outputPath];
      await execa('import', args);
    } else {
      // Generic command
      await execa(cmd, [outputPath], { shell: true });
    }
  }

  async captureWebcam(outputPath: string): Promise<void> {
    const cmd = this.overrides.webcam;
    
    if (cmd) {
      await execa(cmd, [outputPath], { shell: true });
    } else {
      // Use ffmpeg to capture one frame from webcam
      await execa('ffmpeg', [
        '-y',
        '-f', 'v4l2',
        '-i', '/dev/video0',
        '-frames:v', '1',
        outputPath,
      ], { timeout: 10000 });
    }
  }

  async startRecording(outputPath: string): Promise<RecordingHandle> {
    const cmd = this.overrides.microphone;
    
    let process;
    if (cmd) {
      process = execa(cmd, [outputPath], { shell: true });
    } else {
      // Try parecord first (PulseAudio), fall back to arecord (ALSA)
      try {
        process = execa('parecord', ['--file-format=wav', outputPath]);
      } catch {
        process = execa('arecord', ['-f', 'cd', outputPath]);
      }
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
      // Try to kill by PID directly
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
      // Try paplay first (PulseAudio), fall back to aplay (ALSA)
      try {
        await execa('paplay', [filePath]);
      } catch {
        await execa('aplay', [filePath]);
      }
    }
  }

  async speak(text: string, voice?: string): Promise<void> {
    const cmd = this.overrides.tts;
    
    if (cmd) {
      await execa(cmd, { input: text, shell: true });
    } else {
      // Try espeak first, fall back to festival
      try {
        const args = voice ? ['-v', voice, text] : [text];
        await execa('espeak', args);
      } catch {
        await execa('festival', ['--tts'], { input: text });
      }
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
      screenshot: await check('scrot') || await check('gnome-screenshot') || await check('import'),
      webcam: await check('ffmpeg') && existsSync('/dev/video0'),
      microphone: await check('parecord') || await check('arecord'),
      speaker: await check('paplay') || await check('aplay'),
      tts: await check('espeak') || await check('festival'),
    };
  }

  private async findScreenshotTool(): Promise<string> {
    const tools = ['scrot', 'gnome-screenshot', 'import'];
    for (const tool of tools) {
      try {
        await execa('which', [tool]);
        return tool;
      } catch {
        continue;
      }
    }
    throw new Error('No screenshot tool found. Install scrot, gnome-screenshot, or imagemagick.');
  }
}
