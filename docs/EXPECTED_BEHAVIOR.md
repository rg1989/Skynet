# Skynet Expected Behavior Documentation

This document describes the expected behavior of the Skynet AI assistant application. Use this as a reference when testing to identify bugs or unexpected behavior.

---

## 1. Application Startup

### Backend Server (port 3000)

| Event | Expected Behavior |
|-------|-------------------|
| Server start | Logs show: data directories created, config loaded, provider initialized |
| Memory initialization | SQLite database created at `data/memory.db`, embeddings ready |
| Skill registration | All core skills registered (file-ops, exec, web, memory, vision, audio, gmail, self-config) |
| WebSocket ready | WS server listening on same port as HTTP |
| Model warmup | If Ollama, warmup request sent to keep model loaded |

### Frontend Dev Server (port 5173)

| Event | Expected Behavior |
|-------|-------------------|
| Vite start | Hot reload enabled, proxies API requests to backend |
| Build artifacts | Served from `web/dist/` in production mode |

---

## 2. Initial Page Load

### Chat Page (Default View)

| Element | Expected State |
|---------|----------------|
| WebSocket indicator | Green circle when connected, red when disconnected |
| Session sidebar | Shows list of existing sessions, sorted by last activity |
| Current session | Last session from localStorage restored, or most recent, or `web-default` |
| Chat header | Shows current model name (e.g., "claude-sonnet-4-20250514") |
| Message area | Previous messages loaded if session has history |
| Input bar | Empty, focused, ready for input |

### Session Restoration Priority

1. Check `localStorage.skynet_current_session`
2. If valid session exists, load it
3. Otherwise, load most recent session by `lastActivity`
4. Fallback to `web-default` session

---

## 3. Chat Functionality

### Sending a Message

| Step | Expected Behavior |
|------|-------------------|
| User types and presses Enter | Message appears immediately (optimistic update) |
| WebSocket receives `agent:start` | "Thinking..." indicator appears |
| WebSocket receives `agent:token` | Streaming content appears in response area |
| WebSocket receives `agent:end` | Final message appears, streaming content clears |
| Session updated | Message count in sidebar increases |

### Message Persistence

| Scenario | Expected Behavior |
|----------|-------------------|
| Page refresh | All messages reload from session file |
| Browser close/reopen | Session restored, messages intact |
| Session file location | `data/sessions/{sessionKey}.jsonl` |

### Context Within Session

| Scenario | Expected Behavior |
|----------|-------------------|
| Follow-up question | AI remembers previous messages in conversation |
| Reference earlier message | AI can recall what was said earlier |
| Token limit reached | Oldest messages truncated, recent preserved |

---

## 4. Tool Execution

### Available Tools

| Category | Tools |
|----------|-------|
| File Operations | `read_file`, `write_file`, `edit_file`, `list_directory` |
| Command Execution | `exec` |
| Web | `web_fetch`, `web_search` |
| Memory | `remember_fact`, `recall_fact`, `list_facts`, `remember`, `search_memory`, `forget` |
| Vision | `take_screenshot`, `take_photo`, `analyze_image` |
| Audio | `record_audio`, `start_recording`, `stop_recording`, `transcribe`, `speak`, `play_audio` |
| Gmail | `gmail_read`, `gmail_send`, `gmail_mark_read` |
| Self-Config | `get_config`, `list_tools`, `enable_tool`, `disable_tool`, `set_tools_mode`, `switch_provider`, `switch_model`, `list_models`, `get_system_prompt`, `set_system_prompt` |

### Tool Execution Flow

| Event | Expected Behavior |
|-------|-------------------|
| AI decides to use tool | `agent:tool_start` WebSocket event fired |
| Tool executing | UI shows tool name and "executing" status |
| Tool completes | `agent:tool_end` event with result |
| AI continues | Follow-up response incorporates tool result |
| Max iterations | Up to 10 tool calls per message |

### Tool Modes

| Mode | Behavior |
|------|----------|
| `hybrid` (default) | Try native API tool calls, fallback to text parsing |
| `native` | Only use API-level tool calls |
| `text` | Parse tool calls from response text |
| `disabled` | No tools available |

---

## 5. Tool Enable/Disable

### Enabling a Tool

| Action | Expected Behavior |
|--------|-------------------|
| Ask AI to enable a tool | AI uses `enable_tool`, confirms success |
| Via Settings UI | Toggle switch turns on, API call made |
| Result | Tool available in next agent run |

### Disabling a Tool

| Action | Expected Behavior |
|--------|-------------------|
| Ask AI to disable a tool | AI uses `disable_tool`, confirms success |
| Via Settings UI | Toggle switch turns off |
| Result | Tool unavailable, AI should acknowledge if asked to use it |

### Protected Tools (Cannot Disable)

- `get_config`
- `list_tools`
- `enable_tool`
- `disable_tool`
- `switch_provider`
- `switch_model`

---

## 6. Session Management

### Creating New Session

| Action | Expected Behavior |
|--------|-------------------|
| Click "New Chat" | New session created with key `chat-{timestamp}` |
| UI state | Messages cleared, new session appears in sidebar |
| localStorage | Updated with new session key |

### Switching Sessions

| Action | Expected Behavior |
|--------|-------------------|
| Click session in sidebar | Session loads, messages appear |
| Previous session | Preserved, can switch back |
| localStorage | Updated with selected session key |

### Deleting Sessions

| Action | Expected Behavior |
|--------|-------------------|
| Click delete icon | Confirmation modal appears |
| Confirm delete | Session file removed, session disappears from sidebar |
| If active session deleted | New chat created automatically |
| Cancel delete | Nothing happens, session preserved |

### Session Display

| Field | Format |
|-------|--------|
| Title | "Chat [time]" for `chat-*` keys, "Default Chat" for `web-default` |
| Message count | Number badge |
| Last activity | Relative time (e.g., "2 hours ago") |

---

## 7. Settings Page

### Provider Settings

| Element | Expected Behavior |
|---------|-------------------|
| Provider dropdown | Shows: ollama, openai, anthropic |
| Model dropdown | Updates based on selected provider |
| Warmup button | Sends warmup request to current model |

### API Keys

| Field | Expected Behavior |
|-------|-------------------|
| OpenAI API Key | Password input, tests connection on save |
| Anthropic API Key | Password input, tests connection on save |
| Save | Persists to runtime config, shows success/error |

### Tools Settings

| Element | Expected Behavior |
|---------|-------------------|
| Mode dropdown | hybrid, native, text, disabled |
| Tool toggles | Each tool can be enabled/disabled |
| Protected tools | Should not have disable option or show warning |

### System Prompt

| Element | Expected Behavior |
|---------|-------------------|
| Textarea | Shows current system prompt |
| Save button | Persists changes |
| Reset button | Restores default prompt |
| Custom badge | Appears when prompt differs from default |

---

## 8. WebSocket Events

### Event Types

| Event | Payload | When Fired |
|-------|---------|------------|
| `agent:start` | `{ runId }` | Agent begins processing |
| `agent:thinking` | `{ content }` | Thinking/reasoning content (if supported) |
| `agent:token` | `{ delta }` | Each token of streaming response |
| `agent:tool_start` | `{ tool, args }` | Tool execution begins |
| `agent:tool_end` | `{ tool, result }` | Tool execution completes |
| `agent:end` | `{ runId }` | Agent finishes processing |

### Connection States

| State | UI Indicator |
|-------|--------------|
| Connected | Green circle |
| Disconnected | Red circle |
| Reconnecting | Auto-reconnect after 3 seconds |

---

## 9. Memory System

### Fact Storage

| Action | Expected Behavior |
|--------|-------------------|
| `remember_fact` | Key-value pair stored in SQLite |
| `recall_fact` | Returns value for given key |
| `list_facts` | Returns all facts (optionally filtered) |

### Semantic Memory

| Action | Expected Behavior |
|--------|-------------------|
| `remember` | Text stored with embedding for semantic search |
| `search_memory` | Returns relevant memories by semantic similarity |
| `forget` | Removes specified memory |

### Cross-Session Memory

| Scenario | Expected Behavior |
|----------|-------------------|
| New session | Memory persists (stored in SQLite, not session) |
| Different user query | Can recall facts from previous sessions |

---

## 10. Provider Behavior

### Anthropic

| Feature | Expected Behavior |
|---------|-------------------|
| Streaming | Full streaming support via `agent:token` events |
| Tool calls | Native `tool_use` blocks in API response |
| Models | claude-sonnet-4-20250514, claude-opus-4-20250514 |

### OpenAI

| Feature | Expected Behavior |
|---------|-------------------|
| Streaming | Full streaming support |
| Tool calls | Native function calling |
| Models | gpt-4o, gpt-4o-mini |

### Ollama (Local)

| Feature | Expected Behavior |
|---------|-------------------|
| Streaming | Supported but may be slower |
| Tool calls | Supported via function calling |
| Cold start | First message after inactivity may be slow (model loading) |
| Warmup | Sends minimal request at startup to pre-load model |

---

## 11. Error Handling

### API Errors

| Error | Expected Behavior |
|-------|-------------------|
| Invalid API key | Error message shown, prompt to update in Settings |
| Rate limit | Error message, may retry after delay |
| Network error | WebSocket disconnects, shows reconnecting state |

### Tool Errors

| Error | Expected Behavior |
|-------|-------------------|
| Tool not found | Error result returned to AI, AI explains issue |
| Tool execution fails | Error included in context, AI may retry or explain |
| Permission denied | Error message with details |

### Session Errors

| Error | Expected Behavior |
|-------|-------------------|
| Session file missing | Empty session created |
| Corrupted session file | Error logged, may need manual recovery |

---

## 12. Performance Expectations

### Response Times (Anthropic)

| Operation | Expected Time |
|-----------|---------------|
| First token | < 2 seconds |
| Full response | Depends on length, ~50-100 tokens/sec |
| Tool execution | < 5 seconds for most tools |

### Response Times (Ollama Local)

| Operation | Expected Time |
|-----------|---------------|
| Cold start first token | 5-15 seconds (model loading) |
| Warm first token | < 3 seconds |
| Full response | ~20-50 tokens/sec (hardware dependent) |

### UI Responsiveness

| Action | Expected Time |
|--------|---------------|
| Session switch | < 500ms |
| Settings save | < 1 second |
| Page load | < 2 seconds |

---

## 13. Known Limitations

1. **No cross-session context**: Each session is independent (except for memory system)
2. **Model unloading**: Ollama may unload models after 5 minutes of inactivity
3. **No offline mode**: Requires backend server running
4. **Single user**: No authentication, designed for single-user local use
5. **Tool limitations**: Some tools require specific hardware (webcam, microphone)

---

## 14. Testing Checklist

Use this checklist when testing the application:

- [ ] Server starts without errors
- [ ] Frontend loads and connects to WebSocket
- [ ] Can send and receive chat messages
- [ ] Messages persist after page refresh
- [ ] AI remembers context within session
- [ ] Tools execute correctly (test file operations)
- [ ] Can disable and enable tools
- [ ] Session creation works
- [ ] Session switching preserves history
- [ ] Session deletion works with confirmation
- [ ] Settings page loads current values
- [ ] Provider/model can be changed
- [ ] System prompt can be modified
- [ ] No console errors during normal operation
