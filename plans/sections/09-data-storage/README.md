# Data Storage Implementation Guide

[← Back to Architecture](../../ARCHITECTURE.md)

---

## Implementation Progress

| Task | Status | Notes |
|------|--------|-------|
| Define storage structure | ⬜ | |
| Implement session store | ⬜ | |
| Build transcript system | ⬜ | |
| Create credential storage | ⬜ | |
| Add config persistence | ⬜ | |
| Implement migrations | ⬜ | |
| Add backup system | ⬜ | |
| Build cleanup utilities | ⬜ | |
| Write tests | ⬜ | |

---

## Overview

The Data Storage system manages:

- **Sessions** - Conversation metadata and transcripts
- **Credentials** - API keys and channel credentials
- **Configuration** - User settings and preferences
- **Agent State** - Auth profiles, memory indices

```
~/.skynet/
├── skynet.json                  # Main config
├── skynet.json.bak.1           # Config backups
├── agents/
│   └── <agentId>/
│       ├── sessions/
│       │   ├── sessions.json   # Session metadata
│       │   └── <id>.jsonl      # Transcripts
│       └── agent/
│           └── auth-profiles.json
├── credentials/
│   └── <provider>/
│       └── <accountId>/
│           └── creds.json
└── memory/
    └── <agentId>/
        ├── index.db            # SQLite with vector
        └── embeddings/
```

---

## File Structure

```
src/storage/
├── paths.ts               # Path resolution
├── sessions/
│   ├── store.ts           # Session store
│   ├── transcript.ts      # JSONL transcripts
│   └── types.ts           # Session types
├── credentials/
│   ├── store.ts           # Credential store
│   └── encryption.ts      # Secret encryption
├── config/
│   ├── backup.ts          # Config backups
│   └── recovery.ts        # Recovery utilities
├── migrations/
│   ├── runner.ts          # Migration runner
│   └── migrations/
│       ├── v1-to-v2.ts
│       └── ...
└── cleanup/
    ├── sessions.ts        # Session cleanup
    └── transcripts.ts     # Transcript cleanup
```

---

## Core Components

### 1. Path Resolution

**File:** `src/storage/paths.ts`

```typescript
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Get the state directory path
 */
export function getStateDir(): string {
  // Check environment variable
  const envDir = process.env.SKYNET_STATE_DIR;
  if (envDir) {
    return envDir;
  }
  
  // Default paths
  const paths = [
    join(homedir(), '.skynet'),
    join(homedir(), '.moltbot'), // Legacy
  ];
  
  // Return first existing or create default
  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  return paths[0];
}

/**
 * Get config file paths to check (in priority order)
 */
export function getConfigPaths(): string[] {
  const stateDir = getStateDir();
  
  return [
    process.env.SKYNET_CONFIG_PATH,
    join(stateDir, 'skynet.json'),
    join(stateDir, 'config.json'),
  ].filter(Boolean) as string[];
}

/**
 * Get sessions directory for an agent
 */
export function getSessionsDir(agentId: string): string {
  return join(getStateDir(), 'agents', agentId, 'sessions');
}

/**
 * Get agent directory
 */
export function getAgentDir(agentId: string): string {
  return join(getStateDir(), 'agents', agentId, 'agent');
}

/**
 * Get credentials directory for a provider
 */
export function getCredentialsDir(provider: string, accountId: string): string {
  return join(getStateDir(), 'credentials', provider, accountId);
}

/**
 * Get memory directory for an agent
 */
export function getMemoryDir(agentId: string): string {
  return join(getStateDir(), 'memory', agentId);
}
```

### 2. Session Store

**File:** `src/storage/sessions/store.ts`

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getSessionsDir } from '../paths';
import type { SessionEntry, SessionMetadata } from './types';

/**
 * Session store - manages session metadata
 */
export class SessionStore {
  private sessions = new Map<string, SessionEntry>();
  private loaded = false;
  private dirty = false;
  
  constructor(private agentId: string) {}
  
  /**
   * Get store file path
   */
  private get storePath(): string {
    return join(getSessionsDir(this.agentId), 'sessions.json');
  }
  
  /**
   * Load sessions from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    
    if (existsSync(this.storePath)) {
      const content = await readFile(this.storePath, 'utf-8');
      const data = JSON.parse(content);
      
      for (const [key, entry] of Object.entries(data.sessions || {})) {
        this.sessions.set(key, entry as SessionEntry);
      }
    }
    
    this.loaded = true;
  }
  
  /**
   * Save sessions to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) return;
    
    await mkdir(getSessionsDir(this.agentId), { recursive: true });
    
    const data = {
      version: 1,
      sessions: Object.fromEntries(this.sessions),
    };
    
    await writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
    this.dirty = false;
  }
  
  /**
   * Get a session entry
   */
  get(sessionKey: string): SessionEntry | undefined {
    return this.sessions.get(sessionKey);
  }
  
  /**
   * Set a session entry
   */
  set(sessionKey: string, entry: SessionEntry): void {
    this.sessions.set(sessionKey, entry);
    this.dirty = true;
  }
  
  /**
   * Update session metadata
   */
  update(sessionKey: string, updates: Partial<SessionEntry>): void {
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      this.sessions.set(sessionKey, { ...existing, ...updates });
      this.dirty = true;
    }
  }
  
  /**
   * Delete a session
   */
  delete(sessionKey: string): boolean {
    const deleted = this.sessions.delete(sessionKey);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }
  
  /**
   * List all sessions
   */
  list(): SessionEntry[] {
    return [...this.sessions.values()];
  }
  
  /**
   * Get session count
   */
  get size(): number {
    return this.sessions.size;
  }
  
  /**
   * Create or get session
   */
  getOrCreate(sessionKey: string): SessionEntry {
    let entry = this.sessions.get(sessionKey);
    
    if (!entry) {
      entry = {
        sessionId: this.generateSessionId(sessionKey),
        sessionKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(sessionKey, entry);
      this.dirty = true;
    }
    
    return entry;
  }
  
  /**
   * Generate session ID from key
   */
  private generateSessionId(sessionKey: string): string {
    // Use a hash of the key + timestamp
    const hash = require('crypto')
      .createHash('sha256')
      .update(sessionKey + Date.now())
      .digest('hex')
      .slice(0, 16);
    
    return hash;
  }
}
```

### 3. Session Types

**File:** `src/storage/sessions/types.ts`

```typescript
/**
 * Session entry in the store
 */
export interface SessionEntry {
  /** Unique session ID */
  sessionId: string;
  
  /** Session key (routing key) */
  sessionKey: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
  
  /** Approximate token count */
  tokenCount?: number;
  
  /** Session overrides */
  overrides?: SessionOverrides;
  
  /** Session metadata */
  metadata?: SessionMetadata;
}

/**
 * Session overrides
 */
export interface SessionOverrides {
  /** Model override */
  model?: string;
  
  /** Temperature override */
  temperature?: number;
  
  /** System prompt addition */
  systemPromptAddition?: string;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Conversation label */
  label?: string;
  
  /** Channel source */
  channel?: string;
  
  /** Last message preview */
  lastMessagePreview?: string;
  
  /** Custom tags */
  tags?: string[];
}

/**
 * Session message in transcript
 */
export interface SessionMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'tool' | 'system';
  
  /** Message content */
  content: string;
  
  /** Tool call ID (for tool messages) */
  toolCallId?: string;
  
  /** Tool calls (for assistant messages) */
  toolCalls?: ToolCall[];
  
  /** Message timestamp */
  timestamp: number;
  
  /** Token count estimate */
  tokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
```

### 4. Transcript Storage

**File:** `src/storage/sessions/transcript.ts`

```typescript
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { getSessionsDir } from '../paths';
import type { SessionMessage } from './types';

/**
 * JSONL transcript storage
 */
export class TranscriptStore {
  constructor(
    private agentId: string,
    private sessionId: string
  ) {}
  
  /**
   * Get transcript file path
   */
  private get transcriptPath(): string {
    return join(getSessionsDir(this.agentId), `${this.sessionId}.jsonl`);
  }
  
  /**
   * Append a message to the transcript
   */
  async append(message: SessionMessage): Promise<void> {
    await mkdir(getSessionsDir(this.agentId), { recursive: true });
    
    const line = JSON.stringify(message) + '\n';
    await appendFile(this.transcriptPath, line, 'utf-8');
  }
  
  /**
   * Read all messages from transcript
   */
  async readAll(): Promise<SessionMessage[]> {
    if (!existsSync(this.transcriptPath)) {
      return [];
    }
    
    const messages: SessionMessage[] = [];
    
    const stream = createReadStream(this.transcriptPath);
    const rl = createInterface({ input: stream });
    
    for await (const line of rl) {
      if (line.trim()) {
        messages.push(JSON.parse(line));
      }
    }
    
    return messages;
  }
  
  /**
   * Read last N messages
   */
  async readLast(n: number): Promise<SessionMessage[]> {
    const all = await this.readAll();
    return all.slice(-n);
  }
  
  /**
   * Clear transcript
   */
  async clear(): Promise<void> {
    if (existsSync(this.transcriptPath)) {
      await writeFile(this.transcriptPath, '', 'utf-8');
    }
  }
  
  /**
   * Get message count
   */
  async count(): Promise<number> {
    const messages = await this.readAll();
    return messages.length;
  }
  
  /**
   * Compact transcript (remove old messages)
   */
  async compact(keepLast: number): Promise<void> {
    const messages = await this.readAll();
    
    if (messages.length <= keepLast) {
      return;
    }
    
    const toKeep = messages.slice(-keepLast);
    const content = toKeep.map(m => JSON.stringify(m)).join('\n') + '\n';
    
    await writeFile(this.transcriptPath, content, 'utf-8');
  }
}
```

### 5. Credential Store

**File:** `src/storage/credentials/store.ts`

```typescript
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getCredentialsDir } from '../paths';
import { encrypt, decrypt } from './encryption';

export interface Credential {
  /** Credential type */
  type: 'api-key' | 'oauth' | 'token';
  
  /** Credential value (encrypted at rest) */
  value: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Expiration timestamp (for tokens) */
  expiresAt?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Credential store for a provider/account
 */
export class CredentialStore {
  constructor(
    private provider: string,
    private accountId: string
  ) {}
  
  /**
   * Get credentials file path
   */
  private get credPath(): string {
    return join(getCredentialsDir(this.provider, this.accountId), 'creds.json');
  }
  
  /**
   * Get credential
   */
  async get(): Promise<Credential | null> {
    if (!existsSync(this.credPath)) {
      return null;
    }
    
    const content = await readFile(this.credPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Decrypt value
    if (data.encrypted) {
      data.value = await decrypt(data.value);
    }
    
    return data;
  }
  
  /**
   * Set credential
   */
  async set(credential: Credential): Promise<void> {
    await mkdir(getCredentialsDir(this.provider, this.accountId), { recursive: true });
    
    // Encrypt value
    const encrypted = await encrypt(credential.value);
    
    const data = {
      ...credential,
      value: encrypted,
      encrypted: true,
    };
    
    await writeFile(this.credPath, JSON.stringify(data, null, 2), 'utf-8');
  }
  
  /**
   * Delete credential
   */
  async delete(): Promise<void> {
    if (existsSync(this.credPath)) {
      await rm(this.credPath);
    }
  }
  
  /**
   * Check if credential exists
   */
  exists(): boolean {
    return existsSync(this.credPath);
  }
  
  /**
   * Check if credential is expired
   */
  async isExpired(): Promise<boolean> {
    const cred = await this.get();
    if (!cred || !cred.expiresAt) {
      return false;
    }
    return cred.expiresAt < Date.now();
  }
}
```

### 6. Credential Encryption

**File:** `src/storage/credentials/encryption.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Get or create encryption key
 */
function getEncryptionKey(): Buffer {
  // In production, use a secure key derivation from a master secret
  // This is a simplified example
  const masterSecret = process.env.SKYNET_MASTER_SECRET || 'default-secret';
  return scryptSync(masterSecret, 'salt', 32);
}

/**
 * Encrypt a value
 */
export async function encrypt(value: string): Promise<string> {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(value, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a value
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = getEncryptionKey();
  
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  
  return decrypted;
}
```

### 7. Migration System

**File:** `src/storage/migrations/runner.ts`

```typescript
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getStateDir } from '../paths';

export interface Migration {
  /** Migration version */
  version: number;
  
  /** Migration name */
  name: string;
  
  /** Run migration */
  up: (stateDir: string) => Promise<void>;
  
  /** Rollback migration */
  down?: (stateDir: string) => Promise<void>;
}

/**
 * Run pending migrations
 */
export async function runMigrations(migrations: Migration[]): Promise<void> {
  const stateDir = getStateDir();
  const versionFile = join(stateDir, '.migration-version');
  
  // Get current version
  let currentVersion = 0;
  if (existsSync(versionFile)) {
    currentVersion = parseInt(await readFile(versionFile, 'utf-8'), 10);
  }
  
  // Sort migrations by version
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  
  // Run pending migrations
  for (const migration of sorted) {
    if (migration.version <= currentVersion) {
      continue;
    }
    
    console.log(`Running migration ${migration.version}: ${migration.name}`);
    
    try {
      await migration.up(stateDir);
      
      // Update version
      await writeFile(versionFile, migration.version.toString(), 'utf-8');
      currentVersion = migration.version;
      
      console.log(`Migration ${migration.version} completed`);
    } catch (err) {
      console.error(`Migration ${migration.version} failed:`, err);
      throw err;
    }
  }
}

/**
 * Get pending migrations
 */
export async function getPendingMigrations(
  migrations: Migration[]
): Promise<Migration[]> {
  const stateDir = getStateDir();
  const versionFile = join(stateDir, '.migration-version');
  
  let currentVersion = 0;
  if (existsSync(versionFile)) {
    currentVersion = parseInt(await readFile(versionFile, 'utf-8'), 10);
  }
  
  return migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);
}
```

---

## Storage Operations

### Backup System

```typescript
import { copyFile, readdir, rm } from 'fs/promises';
import { join } from 'path';

/**
 * Create backup of a file
 */
async function createBackup(filePath: string, maxBackups = 5): Promise<void> {
  // Rotate existing backups
  for (let i = maxBackups - 1; i >= 1; i--) {
    const current = `${filePath}.bak.${i}`;
    const next = `${filePath}.bak.${i + 1}`;
    
    if (existsSync(current)) {
      if (i === maxBackups - 1) {
        await rm(current);
      } else {
        await copyFile(current, next);
      }
    }
  }
  
  // Create new backup
  if (existsSync(filePath)) {
    await copyFile(filePath, `${filePath}.bak.1`);
  }
}

/**
 * Restore from backup
 */
async function restoreFromBackup(filePath: string, backupNum = 1): Promise<void> {
  const backupPath = `${filePath}.bak.${backupNum}`;
  
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }
  
  await copyFile(backupPath, filePath);
}
```

### Cleanup Utilities

```typescript
import { readdir, rm, stat } from 'fs/promises';
import { join } from 'path';

/**
 * Clean up old sessions
 */
async function cleanupOldSessions(
  agentId: string,
  maxAgeDays: number
): Promise<number> {
  const sessionsDir = getSessionsDir(agentId);
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  let deleted = 0;
  
  const files = await readdir(sessionsDir);
  
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    
    const filePath = join(sessionsDir, file);
    const stats = await stat(filePath);
    
    if (stats.mtimeMs < cutoff) {
      await rm(filePath);
      deleted++;
    }
  }
  
  return deleted;
}

/**
 * Get storage usage
 */
async function getStorageUsage(agentId: string): Promise<StorageUsage> {
  const sessionsDir = getSessionsDir(agentId);
  let totalSize = 0;
  let fileCount = 0;
  
  const files = await readdir(sessionsDir);
  
  for (const file of files) {
    const filePath = join(sessionsDir, file);
    const stats = await stat(filePath);
    totalSize += stats.size;
    fileCount++;
  }
  
  return {
    totalBytes: totalSize,
    fileCount,
    humanReadable: formatBytes(totalSize),
  };
}
```

---

## Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from './sessions/store';
import { TranscriptStore } from './sessions/transcript';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Session Store', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-'));
    process.env.SKYNET_STATE_DIR = tempDir;
  });
  
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    delete process.env.SKYNET_STATE_DIR;
  });
  
  it('should create and retrieve sessions', async () => {
    const store = new SessionStore('default');
    await store.load();
    
    const entry = store.getOrCreate('test-session');
    
    expect(entry.sessionKey).toBe('test-session');
    expect(entry.sessionId).toBeDefined();
  });
  
  it('should persist sessions', async () => {
    const store1 = new SessionStore('default');
    await store1.load();
    store1.getOrCreate('test-session');
    await store1.save();
    
    const store2 = new SessionStore('default');
    await store2.load();
    
    expect(store2.get('test-session')).toBeDefined();
  });
});

describe('Transcript Store', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-'));
    process.env.SKYNET_STATE_DIR = tempDir;
  });
  
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });
  
  it('should append and read messages', async () => {
    const store = new TranscriptStore('default', 'session1');
    
    await store.append({
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });
    
    await store.append({
      role: 'assistant',
      content: 'Hi there!',
      timestamp: Date.now(),
    });
    
    const messages = await store.readAll();
    
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });
});
```

---

## Next Steps

After implementing Data Storage:

1. **[Agent System →](../05-agent-system/README.md)** - Uses session storage
2. **[Configuration System →](../03-configuration-system/README.md)** - Uses config storage

---

## References

- [Node.js fs/promises](https://nodejs.org/api/fs.html#promises-api)
- [JSONL Format](https://jsonlines.org/)
- [Node.js crypto](https://nodejs.org/api/crypto.html)
