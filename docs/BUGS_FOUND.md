# Bugs Found During Testing

This document lists bugs discovered during the QA testing session on 2026-01-29.

---

## Critical Bugs

### 1. Missing dotenv Loading
**Status**: FIXED  
**Location**: `src/index.ts`  
**Description**: The `.env` file was not being loaded because `dotenv` was not installed or imported. Environment variables like `ANTHROPIC_API_KEY` were not being picked up.  
**Fix**: Installed `dotenv` package and added `import 'dotenv/config';` at the top of `src/index.ts`.

---

## UI Bugs

### 2. Provider Badge Shows "ollama" Initially on Page Load
**Status**: FIXED  
**Location**: `web/src/store/index.ts`, `web/src/components/ChatHeader.tsx`  
**Description**: On initial page load, the provider badge briefly shows "ollama" before the API response loads and updates it to the actual provider (e.g., "anthropic"). This is because the Zustand store has `currentProvider: 'ollama'` as the default value.  
**Impact**: Minor visual inconsistency during page load.  
**Fix Applied**: 
- Set default `currentProvider` to empty string `''` in store
- Added `loading: true` default state
- ChatHeader now shows "Loading..." until API responds
- Fixed ChatHeader to find provider by `name` instead of `isDefault`

### 3. Assistant Messages Display Raw JSON for Tool Calls
**Status**: FIXED  
**Location**: `web/src/components/ChatMessage.tsx`, `src/agent/runner.ts`  
**Description**: Some assistant messages display raw JSON strings like `"{\"name\": \"speak\", \"arguments\": {...}}"` instead of properly parsed tool call results or the actual response content.  
**Impact**: Poor user experience - users see technical JSON instead of readable responses.  
**Fix Applied**: 
- Added `extractTextFromToolCall()` function in ChatMessage.tsx to extract text from tool call JSON
- Updated `hasToolCallSyntax()` and `getToolName()` to recognize both "tool" and "name" formats
- Improved backend `extractTextFromToolCallJson()` to handle more patterns
- Messages with extractable text (like "speak" tool) now display the text content instead of raw JSON

### 4. WebSocket Disconnects Briefly on Page Load
**Status**: EXPECTED (race condition)  
**Location**: `web/src/hooks/useWebSocket.ts`  
**Description**: On initial page load, the WebSocket may show "Disconnected" briefly before connecting. This happens because the frontend starts before the backend is fully ready (during development with concurrent startup).  
**Impact**: Minor - WebSocket reconnects automatically after 3 seconds.  
**Mitigation**: The auto-reconnect mechanism handles this gracefully.

---

## Performance Issues

### 5. Ollama Cold Start Takes 25+ Seconds
**Status**: MITIGATED  
**Location**: `src/providers/ollama.ts`  
**Description**: The first message to Ollama after the model has been unloaded takes 25+ seconds due to model loading.  
**Mitigation Applied**:
- Added `keep_alive` parameter (default: "10m") to keep model loaded for 10 minutes after each request
- Added `warmup()` method called at server startup
- Added `ping()` method for periodic keep-alive (not yet used automatically)

### 6. Ollama Tool Calls Can Hang Indefinitely
**Status**: FIXED  
**Location**: `src/providers/ollama.ts`  
**Description**: Tool calls with Ollama could hang indefinitely without any timeout.  
**Fix**: Added configurable timeouts:
- `chatTimeout`: 120000ms (2 minutes) for chat operations
- `embedTimeout`: 30000ms (30 seconds) for embedding operations
- All Ollama API calls now wrapped with `withTimeout()` helper

### 7. No Embedding Caching
**Status**: FIXED  
**Location**: `src/memory/store.ts`  
**Description**: Embeddings were regenerated every time the same text was used, wasting compute resources.  
**Fix**: Added `EmbeddingCache` class with LRU eviction (max 1000 entries) to cache embeddings by text hash.

---

## Configuration Issues

### 8. Hardcoded Default Provider in Store
**Status**: FIXED  
**Location**: `web/src/store/index.ts`  
**Description**: The store defaults to `currentProvider: 'ollama'` which may not match the actual configured provider.  
**Fix Applied**: Changed default `currentProvider` to empty string `''` and added `loading: true` default state.

---

## Summary

| Bug | Severity | Status |
|-----|----------|--------|
| Missing dotenv | Critical | FIXED |
| Provider badge flicker | Low | FIXED |
| Raw JSON in messages | Medium | FIXED |
| WebSocket brief disconnect | Low | EXPECTED |
| Ollama cold start | Medium | MITIGATED |
| Ollama timeout | High | FIXED |
| No embedding cache | Medium | FIXED |
| Hardcoded default provider | Low | FIXED |
| Wrong provider selected in ChatHeader | Low | FIXED |

---

## Files Modified During Fixes

1. `src/index.ts` - Added dotenv import
2. `src/config/schema.ts` - Added Ollama timeout and keep-alive config options
3. `src/providers/ollama.ts` - Added timeouts, keep_alive, and ping method
4. `src/memory/store.ts` - Added EmbeddingCache with LRU eviction
5. `skynet.config.json` - Added timeout and keep-alive settings
6. `package.json` - Added dotenv dependency
7. `web/src/store/index.ts` - Changed default provider to empty string, added loading state
8. `web/src/components/ChatHeader.tsx` - Fixed provider lookup to use currentProvider instead of isDefault, added loading state display
9. `web/src/components/ChatMessage.tsx` - Added extractTextFromToolCall function to extract text from tool call JSON, improved tool call detection for both "tool" and "name" formats
10. `src/agent/runner.ts` - Improved extractTextFromToolCallJson to handle both "name" and "tool" formats, added support for more speech tool patterns
