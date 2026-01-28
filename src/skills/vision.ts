import { join } from 'path';
import { readFileSync } from 'fs';
import type { Skill, SkillResult } from '../types/index.js';
import type { HardwareAdapter } from '../hardware/platform.js';
import type { LLMProvider } from '../providers/types.js';

/**
 * Vision skills - screenshot, webcam, image analysis
 */

// Hardware adapter and vision provider (will be set during initialization)
let hardwareAdapter: HardwareAdapter | null = null;
let visionProvider: LLMProvider | null = null;
let mediaDir = './data/media';

/**
 * Initialize vision skills with hardware adapter and provider
 */
export function initializeVisionSkills(
  adapter: HardwareAdapter,
  provider: LLMProvider,
  dataDir: string
): void {
  hardwareAdapter = adapter;
  visionProvider = provider;
  mediaDir = join(dataDir, 'media');
}

/**
 * Read file as base64
 */
function readAsBase64(filePath: string): string {
  const buffer = readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

export const takeScreenshotSkill: Skill = {
  name: 'take_screenshot',
  description: 'Capture a screenshot of the current screen. Returns the image path and can optionally analyze what is shown.',
  parameters: {
    type: 'object',
    properties: {
      analyze: {
        type: 'boolean',
        description: 'If true, analyze the screenshot and describe what is shown',
      },
      question: {
        type: 'string',
        description: 'Specific question to answer about the screenshot (implies analyze=true)',
      },
    },
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { analyze, question } = params as { analyze?: boolean; question?: string };
    
    try {
      const filename = `screenshot_${Date.now()}.png`;
      const outputPath = join(mediaDir, filename);
      
      await hardwareAdapter.captureScreen(outputPath);
      
      const base64 = readAsBase64(outputPath);
      
      let analysis: string | undefined;
      if ((analyze || question) && visionProvider) {
        const prompt = question || 'Describe what you see in this screenshot in detail.';
        analysis = await visionProvider.analyzeImage(base64, prompt, 'image/png');
      }
      
      context.broadcast('hardware:capture', { type: 'screenshot', path: outputPath });
      
      return {
        success: true,
        data: {
          path: outputPath,
          analysis,
        },
        media: {
          type: 'image',
          path: outputPath,
          base64,
          mimeType: 'image/png',
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

export const takePhotoSkill: Skill = {
  name: 'take_photo',
  description: 'Capture a photo from the webcam. Returns the image path and can optionally analyze what is shown.',
  parameters: {
    type: 'object',
    properties: {
      analyze: {
        type: 'boolean',
        description: 'If true, analyze the photo and describe what is shown',
      },
      question: {
        type: 'string',
        description: 'Specific question to answer about the photo (implies analyze=true)',
      },
    },
  },
  async execute(params, context): Promise<SkillResult> {
    if (!hardwareAdapter) {
      return { success: false, error: 'Hardware adapter not initialized' };
    }

    const { analyze, question } = params as { analyze?: boolean; question?: string };
    
    try {
      const filename = `photo_${Date.now()}.jpg`;
      const outputPath = join(mediaDir, filename);
      
      await hardwareAdapter.captureWebcam(outputPath);
      
      const base64 = readAsBase64(outputPath);
      
      let analysis: string | undefined;
      if ((analyze || question) && visionProvider) {
        const prompt = question || 'Describe what you see in this photo in detail.';
        analysis = await visionProvider.analyzeImage(base64, prompt, 'image/jpeg');
      }
      
      context.broadcast('hardware:capture', { type: 'photo', path: outputPath });
      
      return {
        success: true,
        data: {
          path: outputPath,
          analysis,
        },
        media: {
          type: 'image',
          path: outputPath,
          base64,
          mimeType: 'image/jpeg',
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

export const analyzeImageSkill: Skill = {
  name: 'analyze_image',
  description: 'Analyze an existing image file and describe or answer questions about its contents.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the image file to analyze',
      },
      question: {
        type: 'string',
        description: 'What to analyze or ask about the image',
      },
    },
    required: ['path'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!visionProvider) {
      return { success: false, error: 'Vision provider not initialized' };
    }

    const { path, question } = params as { path: string; question?: string };
    
    try {
      const base64 = readAsBase64(path);
      const mimeType = getMimeType(path);
      const prompt = question || 'Describe what you see in this image in detail.';
      
      const analysis = await visionProvider.analyzeImage(base64, prompt, mimeType);
      
      return {
        success: true,
        data: {
          path,
          analysis,
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

export const visionSkills = [
  takeScreenshotSkill,
  takePhotoSkill,
  analyzeImageSkill,
];
