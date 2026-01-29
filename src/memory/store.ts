import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import type { Fact, Memory, MemorySearchResult } from '../types/index.js';

/**
 * Memory Store - SQLite-based storage for facts and semantic memories
 * Includes embedding cache to prevent redundant embedding generation
 */

// Simple in-memory LRU cache for embeddings
class EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  get(text: string): number[] | undefined {
    const key = this.hash(text);
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(text: string, embedding: number[]): void {
    const key = this.hash(text);
    
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, embedding);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class MemoryStore {
  private db: Database.Database;
  private embedFn?: (text: string) => Promise<number[]>;
  private embeddingCache: EmbeddingCache;

  constructor(dataDir: string) {
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = join(dataDir, 'memory.db');
    this.db = new Database(dbPath);
    this.embeddingCache = new EmbeddingCache(1000); // Cache up to 1000 embeddings
    
    this.initSchema();
  }

  /**
   * Get embedding with caching
   * Returns cached embedding if available, otherwise generates and caches
   */
  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.embedFn) return null;

    // Check cache first
    const cached = this.embeddingCache.get(text);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    try {
      const embedding = await this.embedFn(text);
      this.embeddingCache.set(text, embedding);
      return embedding;
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    // Facts table - key-value store
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Memories table - semantic memories with embeddings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Create index for faster searches
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC)
    `);
  }

  /**
   * Set the embedding function (provided by LLM provider)
   */
  setEmbedFunction(fn: (text: string) => Promise<number[]>): void {
    this.embedFn = fn;
  }

  // ============== Facts API ==============

  /**
   * Store a fact (key-value pair)
   */
  setFact(key: string, value: string, metadata?: Record<string, unknown>): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO facts (key, value, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(key, value, metadata ? JSON.stringify(metadata) : null, now, now);
  }

  /**
   * Get a fact by key
   */
  getFact(key: string): Fact | null {
    const stmt = this.db.prepare('SELECT * FROM facts WHERE key = ?');
    const row = stmt.get(key) as { key: string; value: string; metadata: string | null; created_at: number; updated_at: number } | undefined;
    
    if (!row) return null;
    
    return {
      key: row.key,
      value: row.value,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all facts, optionally filtered by prefix
   */
  listFacts(prefix?: string): Fact[] {
    let stmt;
    let rows: { key: string; value: string; metadata: string | null; created_at: number; updated_at: number }[];
    
    if (prefix) {
      stmt = this.db.prepare('SELECT * FROM facts WHERE key LIKE ? ORDER BY key');
      rows = stmt.all(`${prefix}%`) as typeof rows;
    } else {
      stmt = this.db.prepare('SELECT * FROM facts ORDER BY key');
      rows = stmt.all() as typeof rows;
    }
    
    return rows.map(row => ({
      key: row.key,
      value: row.value,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Delete a fact
   */
  deleteFact(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM facts WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  // ============== Semantic Memory API ==============

  /**
   * Store a memory with embedding (uses cache for efficiency)
   */
  async remember(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    
    // Generate embedding with caching
    let embedding: Buffer | null = null;
    const vector = await this.getEmbedding(content);
    if (vector) {
      embedding = Buffer.from(new Float32Array(vector).buffer);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, content, embedding, metadata ? JSON.stringify(metadata) : null, now);
    
    return id;
  }

  /**
   * Search memories by semantic similarity (uses cached embeddings)
   */
  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    // If no embedding function, fall back to text search
    if (!this.embedFn) {
      return this.textSearch(query, limit);
    }
    
    try {
      // Generate query embedding with caching
      const queryVector = await this.getEmbedding(query);
      if (!queryVector) {
        return this.textSearch(query, limit);
      }
      
      // Get all memories with embeddings
      const stmt = this.db.prepare('SELECT * FROM memories WHERE embedding IS NOT NULL');
      const rows = stmt.all() as { id: string; content: string; embedding: Buffer; metadata: string | null; created_at: number }[];
      
      // Calculate cosine similarity for each
      const results: MemorySearchResult[] = [];
      
      for (const row of rows) {
        const embedding = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.length / 4);
        const score = cosineSimilarity(queryVector, Array.from(embedding));
        
        results.push({
          memory: {
            id: row.id,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
          },
          score,
        });
      }
      
      // Sort by similarity and return top results
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
      
    } catch (error) {
      console.warn('Semantic search failed, falling back to text search:', error);
      return this.textSearch(query, limit);
    }
  }

  /**
   * Simple text search fallback
   */
  private textSearch(query: string, limit: number): MemorySearchResult[] {
    const terms = query.toLowerCase().split(/\s+/);
    const stmt = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC');
    const rows = stmt.all() as { id: string; content: string; embedding: Buffer | null; metadata: string | null; created_at: number }[];
    
    const results: MemorySearchResult[] = [];
    
    for (const row of rows) {
      const contentLower = row.content.toLowerCase();
      const matchCount = terms.filter(term => contentLower.includes(term)).length;
      
      if (matchCount > 0) {
        results.push({
          memory: {
            id: row.id,
            content: row.content,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
          },
          score: matchCount / terms.length,
        });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get a memory by ID
   */
  getMemory(id: string): Memory | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as { id: string; content: string; embedding: Buffer | null; metadata: string | null; created_at: number } | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * List recent memories
   */
  listMemories(limit = 20): Memory[] {
    const stmt = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as { id: string; content: string; embedding: Buffer | null; metadata: string | null; created_at: number }[];
    
    return rows.map(row => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Delete a memory
   */
  forget(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Get memory statistics
   */
  getStats(): { factCount: number; memoryCount: number; memoriesWithEmbeddings: number; embeddingCacheSize: number } {
    const factCount = (this.db.prepare('SELECT COUNT(*) as count FROM facts').get() as { count: number }).count;
    const memoryCount = (this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }).count;
    const memoriesWithEmbeddings = (this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL').get() as { count: number }).count;
    
    return { 
      factCount, 
      memoryCount, 
      memoriesWithEmbeddings,
      embeddingCacheSize: this.embeddingCache.size,
    };
  }

  /**
   * Clear the embedding cache (useful for testing or memory pressure)
   */
  clearEmbeddingCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}
