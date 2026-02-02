import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Session, SessionMessage } from '../types/index.js';

/**
 * Session Manager - handles conversation history persistence
 */
export class SessionManager {
  private sessionsDir: string;

  constructor(dataDir: string) {
    this.sessionsDir = join(dataDir, 'sessions');
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get path to session file
   */
  private getSessionPath(sessionKey: string): string {
    const safeKey = sessionKey.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.sessionsDir, `${safeKey}.jsonl`);
  }

  /**
   * Load a session from disk
   */
  load(sessionKey: string): Session {
    const path = this.getSessionPath(sessionKey);
    const now = Date.now();

    if (!existsSync(path)) {
      return {
        key: sessionKey,
        agentId: 'default',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    const content = readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const messages: SessionMessage[] = lines.map((line: string) => JSON.parse(line));

    return {
      key: sessionKey,
      agentId: 'default',
      messages,
      createdAt: messages[0]?.timestamp || now,
      updatedAt: messages[messages.length - 1]?.timestamp || now,
    };
  }

  /**
   * Save a session to disk (appends new messages)
   */
  save(session: Session): void {
    const path = this.getSessionPath(session.key);
    
    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write all messages (JSONL format)
    const content = session.messages
      .map((m: SessionMessage) => JSON.stringify(m))
      .join('\n') + '\n';
    
    writeFileSync(path, content, 'utf-8');
  }

  /**
   * Append a message to a session
   */
  appendMessage(sessionKey: string, message: SessionMessage): void {
    const path = this.getSessionPath(sessionKey);
    
    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Append message
    const line = JSON.stringify(message) + '\n';
    writeFileSync(path, line, { flag: 'a' });
  }

  /**
   * Clear a session
   */
  clear(sessionKey: string): void {
    const path = this.getSessionPath(sessionKey);
    if (existsSync(path)) {
      writeFileSync(path, '', 'utf-8');
    }
  }

  /**
   * List all sessions
   */
  list(): string[] {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }

    const { readdirSync } = require('fs');
    const files = readdirSync(this.sessionsDir) as string[];
    return files
      .filter((f: string) => f.endsWith('.jsonl'))
      .map((f: string) => f.replace('.jsonl', ''));
  }

  /**
   * Delete a session
   */
  delete(sessionKey: string): void {
    const path = this.getSessionPath(sessionKey);
    if (existsSync(path)) {
      const { unlinkSync } = require('fs');
      unlinkSync(path);
    }
  }
}
