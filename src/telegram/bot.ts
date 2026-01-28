import { Bot, Context, InputFile } from 'grammy';
import type { Config } from '../config/schema.js';
import type { AgentRunner } from '../agent/runner.js';

/**
 * Telegram Bot integration using Grammy
 */

export interface TelegramBotOptions {
  config: Config;
  agentRunner: AgentRunner;
}

export class TelegramBot {
  private bot: Bot;
  private config: Config;
  private agentRunner: AgentRunner;
  private isRunning = false;

  constructor(options: TelegramBotOptions) {
    this.config = options.config;
    this.agentRunner = options.agentRunner;

    if (!this.config.telegram.botToken) {
      throw new Error('Telegram bot token not configured');
    }

    this.bot = new Bot(this.config.telegram.botToken);
    this.setupHandlers();
  }

  /**
   * Set up message handlers
   */
  private setupHandlers(): void {
    // Handle /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'Hello! I\'m Skynet, your personal AI assistant. 🤖\n\n' +
        'I can help you with:\n' +
        '• File operations (read, write, edit)\n' +
        '• Running commands\n' +
        '• Web browsing\n' +
        '• Taking screenshots and photos\n' +
        '• Recording and playing audio\n' +
        '• Remembering information\n\n' +
        'Just send me a message with what you need!'
      );
    });

    // Handle /clear command - clear session
    this.bot.command('clear', async (ctx) => {
      const sessionKey = this.getSessionKey(ctx);
      this.agentRunner.getSessionManager().clear(sessionKey);
      await ctx.reply('Session cleared. Starting fresh! 🔄');
    });

    // Handle /status command
    this.bot.command('status', async (ctx) => {
      const skills = this.agentRunner.getSkills();
      await ctx.reply(
        '📊 Status:\n' +
        `• Skills loaded: ${skills.length}\n` +
        `• Provider: ${this.config.providers.default}\n` +
        `• Memory: ${this.config.agent.memory?.enabled ? 'enabled' : 'disabled'}`
      );
    });

    // Handle text messages
    this.bot.on('message:text', async (ctx) => {
      // Check allowlist
      if (!this.isUserAllowed(ctx)) {
        await ctx.reply('Sorry, you are not authorized to use this bot.');
        return;
      }

      const message = ctx.message.text;
      const sessionKey = this.getSessionKey(ctx);

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      try {
        // Run agent
        const result = await this.agentRunner.run({
          message,
          sessionKey,
        });

        if (result.status === 'success' && result.response) {
          // Split long messages (Telegram limit is 4096 chars)
          await this.sendLongMessage(ctx, result.response);
        } else if (result.status === 'error') {
          await ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        await ctx.reply('Sorry, something went wrong. Please try again.');
      }
    });

    // Handle photos
    this.bot.on('message:photo', async (ctx) => {
      if (!this.isUserAllowed(ctx)) return;

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Get largest size
      const caption = ctx.message.caption || 'What is in this image?';
      const sessionKey = this.getSessionKey(ctx);

      await ctx.replyWithChatAction('typing');

      try {
        // Get file info
        const file = await ctx.api.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.config.telegram.botToken}/${file.file_path}`;
        
        // Download and convert to base64
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        // Run agent with image
        const result = await this.agentRunner.run({
          message: caption,
          sessionKey,
          media: [{
            type: 'image',
            base64,
          }],
        });

        if (result.status === 'success' && result.response) {
          await this.sendLongMessage(ctx, result.response);
        } else if (result.status === 'error') {
          await ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error processing photo:', error);
        await ctx.reply('Sorry, I could not process that image.');
      }
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      if (!this.isUserAllowed(ctx)) return;

      const voice = ctx.message.voice;
      const sessionKey = this.getSessionKey(ctx);

      await ctx.replyWithChatAction('typing');
      await ctx.reply('🎤 Transcribing your voice message...');

      try {
        // Get file info
        const file = await ctx.api.getFile(voice.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.config.telegram.botToken}/${file.file_path}`;
        
        // Download and convert to base64
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        // Run agent with audio
        const result = await this.agentRunner.run({
          message: '[Voice message - please transcribe and respond]',
          sessionKey,
          media: [{
            type: 'audio',
            base64,
          }],
        });

        if (result.status === 'success' && result.response) {
          await this.sendLongMessage(ctx, result.response);
        } else if (result.status === 'error') {
          await ctx.reply(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error processing voice:', error);
        await ctx.reply('Sorry, I could not process that voice message.');
      }
    });

    // Handle documents
    this.bot.on('message:document', async (ctx) => {
      if (!this.isUserAllowed(ctx)) return;

      const doc = ctx.message.document;
      // const caption = ctx.message.caption || `What is in this file: ${doc.file_name}?`;
      // const sessionKey = this.getSessionKey(ctx);

      await ctx.replyWithChatAction('typing');

      try {
        // For now, just acknowledge the document
        // Full document handling would require downloading and processing
        await ctx.reply(`📄 Received document: ${doc.file_name}\n\nDocument processing will be implemented soon.`);
      } catch (error) {
        console.error('Error processing document:', error);
        await ctx.reply('Sorry, I could not process that document.');
      }
    });

    // Error handler
    this.bot.catch((err) => {
      console.error('Telegram bot error:', err);
    });
  }

  /**
   * Check if user is allowed
   */
  private isUserAllowed(ctx: Context): boolean {
    const allowedUsers = this.config.telegram.allowedUsers;
    
    // If no allowlist configured, allow everyone
    if (!allowedUsers || allowedUsers.length === 0) {
      return true;
    }

    const userId = ctx.from?.id;
    return userId !== undefined && allowedUsers.includes(userId);
  }

  /**
   * Generate session key from context
   */
  private getSessionKey(ctx: Context): string {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    // Use chat ID for groups, user ID for DMs
    if (ctx.chat?.type === 'private') {
      return `telegram:dm:${userId}`;
    }
    return `telegram:group:${chatId}`;
  }

  /**
   * Send a long message, splitting if necessary
   */
  private async sendLongMessage(ctx: Context, text: string): Promise<void> {
    const maxLength = 4096;
    
    if (text.length <= maxLength) {
      await ctx.reply(text);
      return;
    }

    // Split by paragraphs or at max length
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Find a good break point
      let breakAt = maxLength;
      const lastNewline = remaining.lastIndexOf('\n\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);

      if (lastNewline > maxLength * 0.7) {
        breakAt = lastNewline + 2;
      } else if (lastSpace > maxLength * 0.7) {
        breakAt = lastSpace + 1;
      }

      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt);
    }

    // Send each chunk
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  }

  /**
   * Send a photo to a chat
   */
  async sendPhoto(chatId: number | string, imagePath: string, caption?: string): Promise<void> {
    await this.bot.api.sendPhoto(chatId, new InputFile(imagePath), { caption });
  }

  /**
   * Send audio to a chat
   */
  async sendAudio(chatId: number | string, audioPath: string, caption?: string): Promise<void> {
    await this.bot.api.sendAudio(chatId, new InputFile(audioPath), { caption });
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Telegram bot is already running');
      return;
    }

    console.log('Starting Telegram bot...');
    
    // Get bot info
    const me = await this.bot.api.getMe();
    console.log(`Telegram bot connected as @${me.username}`);

    // Start polling
    this.bot.start({
      onStart: () => {
        this.isRunning = true;
        console.log('Telegram bot is now listening for messages');
      },
    });
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping Telegram bot...');
    await this.bot.stop();
    this.isRunning = false;
    console.log('Telegram bot stopped');
  }

  /**
   * Check if bot is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}
