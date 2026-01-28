import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Skill, SkillResult } from '../types/index.js';
import type { Config } from '../config/schema.js';

/**
 * Gmail skills - read and send emails via Google API
 * 
 * Setup instructions:
 * 1. Go to Google Cloud Console
 * 2. Create a project and enable Gmail API
 * 3. Create OAuth 2.0 credentials (Desktop app)
 * 4. Download credentials.json and place in data directory
 * 5. Run the app and authorize when prompted
 */

// Gmail client (will be initialized)
let gmailClient: ReturnType<typeof google.gmail> | null = null;
let config: Config | null = null;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

/**
 * Initialize Gmail with OAuth
 */
export async function initializeGmail(cfg: Config): Promise<boolean> {
  config = cfg;
  
  if (!config.gmail?.credentialsPath) {
    console.log('Gmail not configured (set gmail.credentialsPath in config)');
    return false;
  }

  const credentialsPath = config.gmail.credentialsPath;
  const tokenPath = config.gmail.tokenPath || join(config.dataDir, 'gmail-token.json');

  if (!existsSync(credentialsPath)) {
    console.log(`Gmail credentials not found at: ${credentialsPath}`);
    console.log('Download credentials.json from Google Cloud Console');
    return false;
  }

  try {
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || 'http://localhost'
    );

    // Check for existing token
    if (existsSync(tokenPath)) {
      const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
      oauth2Client.setCredentials(token);
      
      // Refresh token if needed
      oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
          writeFileSync(tokenPath, JSON.stringify(tokens), 'utf-8');
        }
      });
    } else {
      // Need to authorize
      console.log('Gmail authorization required.');
      console.log('To authorize, visit the following URL and paste the code:');
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log(authUrl);
      console.log('\nAfter authorizing, the token will be saved automatically.');
      
      // For now, return false - user needs to authorize manually
      return false;
    }

    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('Gmail client initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Gmail:', error);
    return false;
  }
}

export const gmailReadSkill: Skill = {
  name: 'gmail_read',
  description: 'Read emails from Gmail. Can list recent emails or search for specific messages.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "from:someone@example.com", "is:unread", "subject:meeting")',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of emails to return (default 10, max 50)',
      },
      include_body: {
        type: 'boolean',
        description: 'Include email body in results (default false for list, true for single email)',
      },
    },
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!gmailClient) {
      return { success: false, error: 'Gmail not initialized. Configure OAuth credentials.' };
    }

    const { query, max_results, include_body } = params as {
      query?: string;
      max_results?: number;
      include_body?: boolean;
    };

    try {
      // List messages
      const listResponse = await gmailClient.users.messages.list({
        userId: 'me',
        q: query || '',
        maxResults: Math.min(max_results || 10, 50),
      });

      const messages = listResponse.data.messages || [];
      
      if (messages.length === 0) {
        return {
          success: true,
          data: { count: 0, emails: [], message: 'No emails found' },
        };
      }

      // Get message details
      const emails = await Promise.all(
        messages.slice(0, 10).map(async (msg) => {
          const detail = await gmailClient!.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: include_body ? 'full' : 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) => 
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          let body = '';
          if (include_body && detail.data.payload) {
            body = extractBody(detail.data.payload as Parameters<typeof extractBody>[0]);
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            snippet: detail.data.snippet,
            body: body || undefined,
            labels: detail.data.labelIds,
          };
        })
      );

      return {
        success: true,
        data: {
          count: messages.length,
          showing: emails.length,
          emails,
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

export const gmailSendSkill: Skill = {
  name: 'gmail_send',
  description: 'Send an email via Gmail.',
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address',
      },
      subject: {
        type: 'string',
        description: 'Email subject',
      },
      body: {
        type: 'string',
        description: 'Email body (plain text)',
      },
      cc: {
        type: 'string',
        description: 'CC recipients (comma-separated)',
      },
      bcc: {
        type: 'string',
        description: 'BCC recipients (comma-separated)',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!gmailClient) {
      return { success: false, error: 'Gmail not initialized. Configure OAuth credentials.' };
    }

    const { to, subject, body, cc, bcc } = params as {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    };

    try {
      // Build email
      const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
      ];
      
      if (cc) emailLines.push(`Cc: ${cc}`);
      if (bcc) emailLines.push(`Bcc: ${bcc}`);
      
      emailLines.push('Content-Type: text/plain; charset=utf-8');
      emailLines.push('');
      emailLines.push(body);

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64url');

      // Send email
      const response = await gmailClient.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return {
        success: true,
        data: {
          messageId: response.data.id,
          threadId: response.data.threadId,
          to,
          subject,
          message: 'Email sent successfully',
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

export const gmailMarkReadSkill: Skill = {
  name: 'gmail_mark_read',
  description: 'Mark an email as read or unread.',
  parameters: {
    type: 'object',
    properties: {
      message_id: {
        type: 'string',
        description: 'The ID of the email message',
      },
      read: {
        type: 'boolean',
        description: 'True to mark as read, false to mark as unread',
      },
    },
    required: ['message_id', 'read'],
  },
  async execute(params, _context): Promise<SkillResult> {
    if (!gmailClient) {
      return { success: false, error: 'Gmail not initialized. Configure OAuth credentials.' };
    }

    const { message_id, read } = params as { message_id: string; read: boolean };

    try {
      await gmailClient.users.messages.modify({
        userId: 'me',
        id: message_id,
        requestBody: {
          addLabelIds: read ? [] : ['UNREAD'],
          removeLabelIds: read ? ['UNREAD'] : [],
        },
      });

      return {
        success: true,
        data: { messageId: message_id, markedAs: read ? 'read' : 'unread' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Extract body text from email payload
 */
function extractBody(payload: { body?: { data?: string }; parts?: { body?: { data?: string }; mimeType?: string }[] }): string {
  // Check direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Check parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    // Fall back to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        // Simple HTML stripping
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    }
  }

  return '';
}

export const gmailSkills = [
  gmailReadSkill,
  gmailSendSkill,
  gmailMarkReadSkill,
];
