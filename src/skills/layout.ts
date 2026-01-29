import type { Skill, SkillResult } from '../types/index.js';

/**
 * Layout control skills - allow the agent to control the Avatar Mode UI
 */

export const layoutControlSkill: Skill = {
  name: 'layout_control',
  description: 'Control the Avatar Mode UI layout in the web interface. Use this to resize the avatar panel, show content like images or maps in the avatar area, or adjust the layout for better presentation. Only works when the user has Avatar Mode enabled.',
  parameters: {
    type: 'object',
    properties: {
      avatar_ratio: {
        type: 'number',
        description: 'Avatar panel width ratio from 0.2 (20%) to 0.8 (80%). Use larger ratios when showing detailed content.',
      },
      show_content: {
        type: 'boolean',
        description: 'If true, shows the content display area. If false, hides it and shows the avatar.',
      },
      content_url: {
        type: 'string',
        description: 'URL or path of an image, video, or webpage to display in the content area. Only used when show_content is true.',
      },
    },
  },
  async execute(params, context): Promise<SkillResult> {
    const { avatar_ratio, show_content, content_url } = params as {
      avatar_ratio?: number;
      show_content?: boolean;
      content_url?: string;
    };

    // Validate avatar_ratio if provided
    if (avatar_ratio !== undefined) {
      if (typeof avatar_ratio !== 'number' || avatar_ratio < 0.2 || avatar_ratio > 0.8) {
        return {
          success: false,
          error: 'avatar_ratio must be a number between 0.2 and 0.8',
        };
      }
    }

    // Build the layout update payload
    const layoutUpdate: Record<string, unknown> = {};
    
    if (avatar_ratio !== undefined) {
      layoutUpdate.avatar_ratio = avatar_ratio;
    }
    
    if (show_content !== undefined) {
      layoutUpdate.show_content = show_content;
    }
    
    if (content_url !== undefined) {
      layoutUpdate.content_url = content_url;
    }

    // Broadcast the layout update event to all connected clients
    context.broadcast('layout:update', layoutUpdate);

    return {
      success: true,
      data: {
        message: 'Layout updated',
        ...layoutUpdate,
      },
    };
  },
};

export const layoutSkills = [layoutControlSkill];
