import { join } from 'path';
import type { Skill, SkillResult, RecordingHandle } from '../types/index.js';
import type { HardwareAdapter } from '../hardware/platform.js';
import type { LLMProvider } from '../providers/types.js';

/**
 * Audio skills - recording, playback, TTS, transcription
 */

// Hardware adapter and provider (will be set during initialization)
let hardwareAdapter: HardwareAdapter | null = null;
let audioProvider: LLMProvider | null = null;
let mediaDir = './data/media';

// Active recordings
const activeRecordings: Map<string, RecordingHandle> = new Map();

/**
 * Initialize audio skills with hardware adapter and provider
 */
export function initializeAudioSkills(
  adapter: HardwareAdapter,
  provider: LLMProvider,
  dataDir: string
): void {
  hardwareAdapter = adapter;
  audioProvider = provider;
  mediaDir = join(dataDir, 'media');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const recordAudioSkill: Skill = {
  name: 'record_audio',
  description: 'Record audio from the microphone for a specified duration.',
  parameters: {
    type: 'object',
    properties: {
      duration_seconds: {
        type: 'number',
        description: 'How long to record in seconds (max 60)',
      },
      transcribe: {
        type: 'boolean',
        description: 'If true, transcribe the recording after capture',
      },
    },
    required: ['duration_seconds'],
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { duration_seconds, transcribe } = params as { 
      duration_seconds: number; 
      transcribe?: boolean;
    };
    
    // Limit duration
    const duration = Math.min(Math.max(1, duration_seconds), 60);
    
    try {
      const filename = `recording_${Date.now()}.wav`;
      const outputPath = join(mediaDir, filename);
      
      // Start recording
      const handle = await hardwareAdapter.startRecording(outputPath);
      
      context.broadcast('hardware:audio', { action: 'recording_started', path: outputPath });
      
      // Wait for duration
      await sleep(duration * 1000);
      
      // Stop recording
      await hardwareAdapter.stopRecording(handle);
      
      context.broadcast('hardware:audio', { action: 'recording_stopped', path: outputPath });
      
      let transcription: string | undefined;
      if (transcribe && audioProvider) {
        try {
          transcription = await audioProvider.transcribe(outputPath);
        } catch (error) {
          console.warn('Transcription failed:', error);
        }
      }
      
      return {
        success: true,
        data: {
          path: outputPath,
          duration,
          transcription,
        },
        media: {
          type: 'audio',
          path: outputPath,
          mimeType: 'audio/wav',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const startRecordingSkill: Skill = {
  name: 'start_recording',
  description: 'Start a microphone recording that continues until stopped. Returns a recording ID.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }
    
    try {
      const recordingId = `rec_${Date.now()}`;
      const filename = `recording_${recordingId}.wav`;
      const outputPath = join(mediaDir, filename);
      
      const handle = await hardwareAdapter.startRecording(outputPath);
      activeRecordings.set(recordingId, handle);
      
      context.broadcast('hardware:audio', { action: 'recording_started', recordingId, path: outputPath });
      
      return {
        success: true,
        data: {
          recordingId,
          path: outputPath,
          message: 'Recording started. Use stop_recording to finish.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const stopRecordingSkill: Skill = {
  name: 'stop_recording',
  description: 'Stop an active recording and optionally transcribe it.',
  parameters: {
    type: 'object',
    properties: {
      recording_id: {
        type: 'string',
        description: 'The recording ID returned by start_recording',
      },
      transcribe: {
        type: 'boolean',
        description: 'If true, transcribe the recording',
      },
    },
    required: ['recording_id'],
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { recording_id, transcribe } = params as { 
      recording_id: string; 
      transcribe?: boolean;
    };
    
    const handle = activeRecordings.get(recording_id);
    if (!handle) {
      return { success: false, error: `No active recording with ID: ${recording_id}` };
    }
    
    try {
      await hardwareAdapter.stopRecording(handle);
      activeRecordings.delete(recording_id);
      
      context.broadcast('hardware:audio', { action: 'recording_stopped', recordingId: recording_id });
      
      let transcription: string | undefined;
      if (transcribe && audioProvider) {
        try {
          transcription = await audioProvider.transcribe(handle.outputPath);
        } catch (error) {
          console.warn('Transcription failed:', error);
        }
      }
      
      return {
        success: true,
        data: {
          path: handle.outputPath,
          transcription,
        },
        media: {
          type: 'audio',
          path: handle.outputPath,
          mimeType: 'audio/wav',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const transcribeSkill: Skill = {
  name: 'transcribe',
  description: 'Transcribe an audio file to text using speech recognition.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the audio file to transcribe',
      },
    },
    required: ['path'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!audioProvider) {
      return { success: false, error: 'Audio provider not initialized (need OpenAI for Whisper)' };
    }

    const { path } = params as { path: string };
    
    try {
      const transcription = await audioProvider.transcribe(path);
      
      return {
        success: true,
        data: {
          path,
          transcription,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const speakSkill: Skill = {
  name: 'speak',
  description: 'Speak text aloud using text-to-speech. IMPORTANT: Only use this when the user EXPLICITLY asks you to speak, read aloud, or use voice. Do NOT use this for regular responses - only for on-demand voice requests like "read this aloud" or "say this out loud".',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The specific text to speak aloud (only what the user asked to be spoken)',
      },
      voice: {
        type: 'string',
        description: 'Optional voice name (platform-specific)',
      },
    },
    required: ['text'],
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { text, voice } = params as { text: string; voice?: string };
    
    try {
      await hardwareAdapter.speak(text, voice);
      
      context.broadcast('hardware:audio', { action: 'spoke', text: text.slice(0, 50) });
      
      return {
        success: true,
        data: {
          spoken: true,
          text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const playAudioSkill: Skill = {
  name: 'play_audio',
  description: 'Play an audio file through the speakers.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the audio file to play',
      },
    },
    required: ['path'],
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { path } = params as { path: string };
    
    try {
      await hardwareAdapter.playAudio(path);
      
      context.broadcast('hardware:audio', { action: 'played', path });
      
      return {
        success: true,
        data: {
          played: true,
          path,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const audioSkills = [
  recordAudioSkill,
  startRecordingSkill,
  stopRecordingSkill,
  transcribeSkill,
  speakSkill,
  playAudioSkill,
];
