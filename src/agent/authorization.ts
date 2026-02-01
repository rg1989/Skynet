/**
 * Authorization Storage Module
 * 
 * Manages persistent tool authorizations so users don't have to
 * approve the same tool actions repeatedly.
 */

import { createHash } from 'crypto';
import { getMemoryStore } from '../skills/memory.js';

/**
 * Authorization scope levels
 */
export type AuthorizationScope = 'exact' | 'pattern' | 'tool';

/**
 * Stored authorization record
 */
export interface Authorization {
  id: string;
  toolName: string;
  scope: AuthorizationScope;
  pattern: string;
  description: string;
  createdAt: number;
}

/**
 * Result of checking authorization
 */
export interface AuthorizationCheckResult {
  authorized: boolean;
  matchedAuth?: Authorization;
  suggestedScopes: AuthorizationScope[];
}

// Prefix for authorization facts in memory store
const AUTH_PREFIX = 'auth_';

/**
 * Generate a hash for exact match authorizations
 */
function hashParams(toolName: string, params: Record<string, unknown>): string {
  const normalized = JSON.stringify({ tool: toolName, params }, Object.keys(params).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Extract a pattern from tool parameters for pattern matching
 */
function extractPattern(toolName: string, params: Record<string, unknown>): string {
  switch (toolName) {
    case 'exec': {
      const command = String(params.command || '');
      // Extract the base command (first word) for pattern matching
      const baseCommand = command.split(/\s+/)[0];
      return baseCommand || '*';
    }
    case 'write_file':
    case 'edit_file': {
      const path = String(params.path || params.file_path || '');
      // Extract directory pattern
      const parts = path.split('/');
      if (parts.length > 1) {
        return parts.slice(0, -1).join('/') + '/*';
      }
      return '*';
    }
    case 'gmail_send': {
      const to = String(params.to || '');
      // Extract domain for pattern matching
      const domain = to.split('@')[1];
      return domain ? `*@${domain}` : '*';
    }
    default:
      return '*';
  }
}

/**
 * Create a human-readable description of the authorization
 */
function createAuthDescription(toolName: string, scope: AuthorizationScope, pattern: string, params: Record<string, unknown>): string {
  switch (toolName) {
    case 'exec':
      if (scope === 'exact') {
        return `Execute: ${String(params.command || 'unknown').slice(0, 50)}`;
      } else if (scope === 'pattern') {
        return `Execute commands starting with: ${pattern}`;
      }
      return 'Execute any shell command';
    
    case 'write_file':
    case 'edit_file':
      if (scope === 'exact') {
        return `${toolName === 'write_file' ? 'Write' : 'Edit'}: ${String(params.path || params.file_path || 'unknown')}`;
      } else if (scope === 'pattern') {
        return `${toolName === 'write_file' ? 'Write' : 'Edit'} files in: ${pattern}`;
      }
      return `${toolName === 'write_file' ? 'Write' : 'Edit'} any file`;
    
    case 'gmail_send':
      if (scope === 'exact') {
        return `Send email to: ${String(params.to || 'unknown')}`;
      } else if (scope === 'pattern') {
        return `Send emails to: ${pattern}`;
      }
      return 'Send any email';
    
    default:
      return `${toolName} (${scope})`;
  }
}

/**
 * Check if a tool action is already authorized
 */
export function checkToolAuthorization(
  toolName: string,
  params: Record<string, unknown>
): AuthorizationCheckResult {
  const store = getMemoryStore();
  if (!store) {
    return { authorized: false, suggestedScopes: ['exact', 'pattern', 'tool'] };
  }

  // Generate keys for different scope levels
  const exactKey = `${AUTH_PREFIX}${toolName}_exact_${hashParams(toolName, params)}`;
  const pattern = extractPattern(toolName, params);
  const patternKey = `${AUTH_PREFIX}${toolName}_pattern_${pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const toolKey = `${AUTH_PREFIX}${toolName}_tool_all`;

  // Check tool-wide authorization first (broadest)
  const toolAuth = store.getFact(toolKey);
  if (toolAuth) {
    try {
      const auth = JSON.parse(toolAuth.value) as Authorization;
      return { authorized: true, matchedAuth: auth, suggestedScopes: [] };
    } catch {
      // Invalid stored auth, ignore
    }
  }

  // Check pattern authorization
  const patternAuth = store.getFact(patternKey);
  if (patternAuth) {
    try {
      const auth = JSON.parse(patternAuth.value) as Authorization;
      return { authorized: true, matchedAuth: auth, suggestedScopes: [] };
    } catch {
      // Invalid stored auth, ignore
    }
  }

  // Check exact match authorization
  const exactAuth = store.getFact(exactKey);
  if (exactAuth) {
    try {
      const auth = JSON.parse(exactAuth.value) as Authorization;
      return { authorized: true, matchedAuth: auth, suggestedScopes: [] };
    } catch {
      // Invalid stored auth, ignore
    }
  }

  // Determine which scopes make sense for this tool
  const suggestedScopes: AuthorizationScope[] = ['exact'];
  if (pattern !== '*') {
    suggestedScopes.push('pattern');
  }
  suggestedScopes.push('tool');

  return { authorized: false, suggestedScopes };
}

/**
 * Save a new authorization
 */
export function saveAuthorization(
  toolName: string,
  params: Record<string, unknown>,
  scope: AuthorizationScope
): Authorization {
  const store = getMemoryStore();
  if (!store) {
    throw new Error('Memory store not available');
  }

  const pattern = scope === 'exact' ? hashParams(toolName, params) : extractPattern(toolName, params);
  const id = `${toolName}_${scope}_${scope === 'exact' ? pattern : pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const factKey = `${AUTH_PREFIX}${id}`;

  const auth: Authorization = {
    id,
    toolName,
    scope,
    pattern: scope === 'exact' ? String(params.command || params.path || params.to || 'exact') : pattern,
    description: createAuthDescription(toolName, scope, pattern, params),
    createdAt: Date.now(),
  };

  store.setFact(factKey, JSON.stringify(auth));
  return auth;
}

/**
 * Revoke an authorization by ID
 */
export function revokeAuthorization(authId: string): boolean {
  const store = getMemoryStore();
  if (!store) {
    return false;
  }

  const factKey = `${AUTH_PREFIX}${authId}`;
  store.deleteFact(factKey);
  return true;
}

/**
 * List all saved authorizations
 */
export function listAuthorizations(): Authorization[] {
  const store = getMemoryStore();
  if (!store) {
    return [];
  }

  const allFacts = store.listFacts();
  const authorizations: Authorization[] = [];

  for (const fact of allFacts) {
    if (fact.key.startsWith(AUTH_PREFIX)) {
      try {
        const auth = JSON.parse(fact.value) as Authorization;
        authorizations.push(auth);
      } catch {
        // Skip invalid entries
      }
    }
  }

  // Sort by creation time, newest first
  return authorizations.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Clear all authorizations
 */
export function clearAllAuthorizations(): number {
  const store = getMemoryStore();
  if (!store) {
    return 0;
  }

  const allFacts = store.listFacts();
  let count = 0;

  for (const fact of allFacts) {
    if (fact.key.startsWith(AUTH_PREFIX)) {
      store.deleteFact(fact.key);
      count++;
    }
  }

  return count;
}

/**
 * Get scope label for display
 */
export function getScopeLabel(scope: AuthorizationScope): string {
  switch (scope) {
    case 'exact':
      return 'This exact action';
    case 'pattern':
      return 'Similar actions';
    case 'tool':
      return 'All actions of this type';
  }
}
