import { execa } from 'execa';
import type { HardwareAdapter, HardwareCapabilities } from '../platform.js';
import type { RecordingHandle, ScreenRegion } from '../../types/index.js';

/**
 * Windows hardware adapter
 * Uses: PowerShell scripts, ffmpeg, SAPI
 */

export class WindowsAdapter implements HardwareAdapter {
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
      // Use PowerShell to capture screen
      const script = region
        ? `
          Add-Type -AssemblyName System.Windows.Forms
          $bitmap = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen(${region.x}, ${region.y}, 0, 0, $bitmap.Size)
          $bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}')
        `
        : `
          Add-Type -AssemblyName System.Windows.Forms
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
          $bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}')
        `;
      
      await execa('powershell', ['-Command', script]);
    }
  }

  async captureWebcam(outputPath: string): Promise<void> {
    const cmd = this.overrides.webcam;
    
    if (cmd) {
      await execa(cmd, [outputPath], { shell: true });
    } else {
      // Use ffmpeg with DirectShow
      await execa('ffmpeg', [
        '-y',
        '-f', 'dshow',
        '-i', 'video=Integrated Camera',
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
      // Use ffmpeg with DirectShow audio
      process = execa('ffmpeg', [
        '-y',
        '-f', 'dshow',
        '-i', 'audio=Microphone',
        outputPath,
      ]);
    }

    const pid = process.pid!;
    this.recordingProcesses.set(pid, process);

    return { pid, outputPath };
  }

  async stopRecording(handle: RecordingHandle): Promise<void> {
    const process = this.recordingProcesses.get(handle.pid);
    if (process) {
      // Send 'q' to ffmpeg to quit gracefully
      process.stdin?.write('q');
      setTimeout(() => {
        process.kill('SIGTERM');
      }, 1000);
      this.recordingProcesses.delete(handle.pid);
    } else {
      try {
        await execa('taskkill', ['/PID', String(handle.pid), '/F']);
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
      // Use PowerShell to play audio
      const script = `
        Add-Type -AssemblyName presentationCore
        $player = New-Object System.Windows.Media.MediaPlayer
        $player.Open('${filePath.replace(/\\/g, '\\\\')}')
        $player.Play()
        Start-Sleep -Seconds 1
        while ($player.Position -lt $player.NaturalDuration.TimeSpan) { Start-Sleep -Milliseconds 100 }
      `;
      await execa('powershell', ['-Command', script]);
    }
  }

  async speak(text: string, voice?: string): Promise<void> {
    const cmd = this.overrides.tts;
    
    if (cmd) {
      await execa(cmd, { input: text, shell: true });
    } else {
      // Use SAPI via PowerShell
      const voiceSelect = voice ? `$speech.SelectVoice('${voice}');` : '';
      const script = `
        Add-Type -AssemblyName System.Speech
        $speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
        ${voiceSelect}
        $speech.Speak('${text.replace(/'/g, "''")}')
      `;
      await execa('powershell', ['-Command', script]);
    }
  }

  async checkCapabilities(): Promise<HardwareCapabilities> {
    const checkCmd = async (cmd: string): Promise<boolean> => {
      try {
        await execa('where', [cmd]);
        return true;
      } catch {
        return false;
      }
    };

    return {
      screenshot: true, // PowerShell is always available
      webcam: await checkCmd('ffmpeg'),
      microphone: await checkCmd('ffmpeg'),
      speaker: true, // PowerShell is always available
      tts: true, // SAPI is always available on Windows
    };
  }
}
