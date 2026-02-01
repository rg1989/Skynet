# Skynet Lite - Capabilities & Features

A comprehensive personal AI assistant with multi-provider LLM support, hardware control, memory persistence, voice interaction, and automation capabilities.

## Table of Contents

1. [Overview](#overview)
2. [LLM Providers](#llm-providers)
3. [Skills & Tools](#skills--tools)
4. [Communication Channels](#communication-channels)
5. [Memory System](#memory-system)
6. [Voice Service](#voice-service)
7. [Task Scheduling](#task-scheduling)
8. [Workflow Automation (Prefect)](#workflow-automation-prefect)
9. [Hardware Integration](#hardware-integration)
10. [Security Features](#security-features)
11. [Web Interface](#web-interface)
12. [Architecture](#architecture)

---

## Overview

Skynet Lite is a personal AI assistant built with TypeScript (Node.js backend) and React (frontend). It provides:

- **Multi-provider LLM support** with dynamic switching between OpenAI, Anthropic, and Ollama
- **40+ built-in skills** for file operations, command execution, web browsing, vision, audio, email, and more
- **Persistent memory** with both key-value facts and semantic search capabilities
- **Voice interaction** with Text-to-Speech (TTS) and wake word detection
- **Multi-channel access** via Web UI, Telegram bot, and REST API
- **Task automation** with cron-based scheduling and Prefect workflows

**Implementation Status**: ✅ All features listed are implemented and functional in the codebase.

---

## LLM Providers

Skynet supports multiple LLM providers with runtime switching capability.

### OpenAI
- **Location**: `src/providers/openai.ts`
- **Models Supported**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Features**: 
  - ✅ Chat completion with streaming
  - ✅ Native function/tool calling
  - ✅ Vision (image analysis)
  - ✅ Audio transcription (Whisper)
  - ✅ Text embeddings

### Anthropic
- **Location**: `src/providers/anthropic.ts`
- **Models Supported**: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-3-5-sonnet, claude-3-haiku
- **Features**:
  - ✅ Chat completion with streaming
  - ✅ Native tool use
  - ✅ Vision (image analysis)

### Ollama (Local Models)
- **Location**: `src/providers/ollama.ts`
- **Models Supported**: Any locally installed model (e.g., qwen2.5, llama3, mistral)
- **Features**:
  - ✅ Chat completion with streaming
  - ✅ Text embeddings (nomic-embed-text, mxbai-embed-large)
  - ✅ Model warmup for faster first response
  - ✅ Availability checking

### Provider Manager
- **Location**: `src/providers/index.ts`
- **Features**:
  - ✅ Runtime provider switching (no restart required)
  - ✅ Provider availability checking
  - ✅ Automatic fallback to Ollama on provider failures
  - ✅ Cached provider instances for efficiency

---

## Skills & Tools

All skills are implemented in `src/skills/` and registered via the `SkillRegistry`.

### File Operations (`file-ops.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `read_file` | Read file contents with line numbers | ✅ Implemented |
| `write_file` | Create or overwrite files | ✅ Implemented |
| `edit_file` | Find and replace text in files | ✅ Implemented |
| `list_directory` | List files and directories | ✅ Implemented |

### Command Execution (`exec.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `exec` | Execute shell commands with timeout | ✅ Implemented (uses `execa`) |

### Web Browsing (`web-browse.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `web_fetch` | Fetch and parse web page content | ✅ Implemented (uses `cheerio`) |
| `web_search` | Search via DuckDuckGo HTML | ✅ Implemented (no API key needed) |

### Memory Skills (`memory.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `remember_fact` | Store key-value fact | ✅ Implemented |
| `recall_fact` | Retrieve fact by key | ✅ Implemented |
| `list_facts` | List all facts with optional prefix filter | ✅ Implemented |
| `remember` | Store semantic memory with embeddings | ✅ Implemented |
| `search_memory` | Semantic similarity search | ✅ Implemented |
| `forget` | Delete a fact or memory | ✅ Implemented |

### Vision Skills (`vision.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `take_screenshot` | Capture screen with optional analysis | ✅ Implemented |
| `take_photo` | Capture from webcam with optional analysis | ✅ Implemented |
| `analyze_image` | Analyze existing image file | ✅ Implemented |

### Audio Skills (`audio.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `record_audio` | Record audio for specified duration | ✅ Implemented |
| `start_recording` | Start continuous recording | ✅ Implemented |
| `stop_recording` | Stop recording and optionally transcribe | ✅ Implemented |
| `transcribe` | Transcribe audio file to text | ✅ Implemented (OpenAI Whisper) |
| `speak` | Text-to-speech output | ✅ Implemented |
| `play_audio` | Play audio file | ✅ Implemented |

### Gmail Integration (`gmail.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `gmail_read` | Search and read emails | ✅ Implemented (OAuth2) |
| `gmail_send` | Send emails | ✅ Implemented |
| `gmail_mark_read` | Mark emails as read/unread | ✅ Implemented |

### Self-Configuration (`self-config.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `get_config` | View current configuration | ✅ Implemented |
| `list_tools` | List all tools with status | ✅ Implemented |
| `enable_tool` | Enable a specific tool | ✅ Implemented |
| `disable_tool` | Disable a specific tool | ✅ Implemented |
| `set_tools_mode` | Set hybrid/native/text/disabled mode | ✅ Implemented |
| `switch_provider` | Switch LLM provider | ✅ Implemented |
| `switch_model` | Change model for provider | ✅ Implemented |
| `list_models` | List available models | ✅ Implemented |
| `get_system_prompt` | View system prompt | ✅ Implemented |
| `set_system_prompt` | Modify system prompt | ✅ Implemented |

### Scheduling (`schedule.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `create_scheduled_task` | Create cron-scheduled task | ✅ Implemented |
| `list_scheduled_tasks` | List all scheduled tasks | ✅ Implemented |
| `update_scheduled_task` | Update task settings | ✅ Implemented |
| `delete_scheduled_task` | Remove scheduled task | ✅ Implemented |
| `trigger_scheduled_task` | Run task immediately | ✅ Implemented |

### Prefect Workflows (`prefect.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `prefect_create_flow` | Create multi-step workflow | ✅ Implemented |
| `prefect_run_flow` | Execute workflow | ✅ Implemented |
| `prefect_list_flows` | List available workflows | ✅ Implemented |
| `prefect_get_runs` | Get workflow run history | ✅ Implemented |
| `prefect_delete_flow` | Delete dynamic workflow | ✅ Implemented |

### Layout Control (`layout.ts`)

| Skill | Description | Implementation |
|-------|-------------|----------------|
| `layout_control` | Control Avatar Mode UI layout | ✅ Implemented |

---

## Communication Channels

### Web Interface
- **Location**: `web/src/`
- **Technology**: React + TypeScript + Vite + TailwindCSS
- **Features**:
  - ✅ Real-time chat with streaming responses
  - ✅ Session management (multiple conversations)
  - ✅ Tool execution visualization
  - ✅ Media display (images, audio)
  - ✅ Markdown rendering with code highlighting
  - ✅ Mermaid diagram support
  - ✅ Task list view
  - ✅ Workflow manager
  - ✅ Cron task manager
  - ✅ Settings panel

### WebSocket API
- **Location**: `src/server/ws-handler.ts`
- **Events**:
  - `agent:start` - Agent run started
  - `agent:token` - Streaming token received
  - `agent:tool_start` - Tool execution starting
  - `agent:tool_end` - Tool execution completed
  - `agent:end` - Agent run completed
  - `agent:confirm_required` - High-risk tool confirmation needed
  - `voice:*` - Voice service events
  - `layout:update` - UI layout changes

### REST API
- **Location**: `src/server/routes.ts`
- **Endpoints**:
  - `POST /api/chat` - Send message (non-streaming)
  - `GET /api/sessions` - List sessions
  - `GET /api/sessions/:key` - Get session
  - `DELETE /api/sessions/:key` - Delete session
  - `GET /api/skills` - List available skills
  - `POST /api/speak` - TTS synthesis
  - `GET /api/cron` - List scheduled tasks
  - `POST /api/cron` - Create task
  - `PUT /api/cron/:id` - Update task
  - `DELETE /api/cron/:id` - Delete task
  - `GET /api/config` - Get runtime config
  - `POST /api/config` - Update runtime config
  - `GET /api/voice/settings` - Voice service settings
  - `POST /api/voice/settings` - Update voice settings

### Telegram Bot
- **Location**: `src/telegram/bot.ts`
- **Technology**: Grammy (Telegram Bot Framework)
- **Features**:
  - ✅ Text message handling
  - ✅ Photo processing with vision
  - ✅ Voice message transcription
  - ✅ Document acknowledgment
  - ✅ Session management per chat
  - ✅ User allowlist support
  - ✅ Commands: `/start`, `/clear`, `/status`

---

## Memory System

### Implementation
- **Location**: `src/memory/store.ts`
- **Storage**: SQLite via `better-sqlite3`
- **Database**: `data/memory.db`

### Key-Value Facts
- Simple key-value storage for discrete information
- Supports metadata and timestamps
- Prefix-based filtering for listing

### Semantic Memory
- Stores content with vector embeddings
- Uses cosine similarity for semantic search
- Falls back to text search if embeddings unavailable
- LRU cache for embedding efficiency (up to 1000 entries)

### Embedding Providers
- **OpenAI**: text-embedding-3-small
- **Ollama**: nomic-embed-text, mxbai-embed-large

---

## Voice Service

### Implementation
- **Backend**: Python service in `voice/src/`
- **Manager**: `src/voice/manager.ts`
- **Communication**: WebSocket at port 4202

### Text-to-Speech
- **Engine**: Kokoro TTS with MLX backend (Apple Silicon optimized)
- **Location**: `voice/src/tts.py`
- **Voices Available**:
  - American: af_heart, af_bella, af_sarah, af_nicole, af_sky, am_adam, am_michael
  - British: bf_emma, bf_isabella, bm_george, bm_lewis
- **Features**:
  - ✅ Streaming audio synthesis
  - ✅ Adjustable speech speed
  - ✅ Multiple voice options
  - ✅ Mute/unmute control

### Wake Word Detection
- **Location**: `voice/src/wakeword.py`
- **Engine**: OpenWakeWord
- **Features**:
  - ✅ Configurable wake word model
  - ✅ Adjustable sensitivity threshold
  - ✅ Timeout after detection

---

## Task Scheduling

### Implementation
- **Location**: `src/scheduler/cron.ts`
- **Storage**: `src/scheduler/storage.ts`
- **Engine**: `node-cron`

### Features
- ✅ Cron-based scheduling (standard cron expressions)
- ✅ Persistent storage across restarts
- ✅ Enable/disable tasks
- ✅ Manual task triggering
- ✅ Last run tracking with results
- ✅ WebSocket notifications on task events
- ✅ UI management in web interface

---

## Workflow Automation (Prefect)

### Implementation
- **Bridge Server**: `prefect/server.py` (Python/FastAPI)
- **Skills**: `src/skills/prefect.ts`
- **Port**: 4201

### Supported Step Actions
| Action | Description | Parameters |
|--------|-------------|------------|
| `agent_prompt` | Send prompt to Skynet | prompt, session_key |
| `http_request` | Make HTTP request | method, url, headers, body |
| `delay` | Wait for seconds | seconds |

### Features
- ✅ Dynamic workflow creation
- ✅ Multi-step pipelines with dependencies
- ✅ Workflow run history
- ✅ Integration with Skynet agent

---

## Hardware Integration

### Platform Adapters
- **Location**: `src/hardware/`
- **Supported Platforms**:
  - ✅ macOS (`adapters/macos.ts`)
  - ✅ Linux (`adapters/linux.ts`)
  - ✅ Windows (`adapters/windows.ts`)

### Capabilities

| Capability | macOS | Linux | Windows |
|------------|-------|-------|---------|
| Screenshot | ✅ `screencapture` | ✅ `scrot`/`gnome-screenshot` | ✅ PowerShell |
| Webcam | ✅ `imagesnap` | ✅ `fswebcam` | ✅ `ffmpeg` |
| Audio Recording | ✅ `sox` | ✅ `sox`/`arecord` | ✅ `sox` |
| Audio Playback | ✅ `afplay` | ✅ `aplay`/`paplay` | ✅ `ffplay` |
| TTS (System) | ✅ `say` | ✅ `espeak`/`festival` | ✅ PowerShell SAPI |

---

## Security Features

### High-Risk Tool Confirmation
- **Location**: `src/agent/security.ts`
- **Behavior**: Prompts user confirmation before executing dangerous operations
- **High-Risk Output Tools** (require confirmation):
  - `exec` - Shell command execution
  - `write_file` - File creation/overwrite
  - `edit_file` - File modification
  - `gmail_send` - Sending emails

### Prompt Injection Defense
- **High-Risk Input Tools** (content wrapped with spotlighting markers):
  - `web_fetch` - Web content
  - `web_search` - Search results
  - `gmail_read` - Email content
- **Implementation**: Wraps untrusted content with markers to help LLM distinguish data from instructions

### Telegram User Allowlist
- **Configuration**: `telegram.allowedUsers` in config
- **Behavior**: Only specified user IDs can interact with the bot

### Self-Config Tool Protection
- Self-configuration tools cannot be disabled to prevent agent lock-out

---

## Web Interface

### Location
- **Source**: `web/src/`
- **Build**: Vite + React + TypeScript

### Pages & Components

| Page | Component | Description |
|------|-----------|-------------|
| Chat | `Chat.tsx` | Main chat interface with message history |
| Tasks | `TaskList.tsx` | View and manage agent tasks |
| Workflows | `WorkflowManager.tsx` | Prefect workflow management |
| Schedule | `CronManager.tsx` | Cron task management |
| Settings | `Settings.tsx` | Provider, model, and tool configuration |

### Key Components
- `ChatMessage.tsx` - Message rendering with markdown
- `MarkdownRenderer.tsx` - Markdown with code highlighting
- `MermaidDiagram.tsx` - Mermaid diagram rendering
- `SessionSidebar.tsx` - Session management
- `ControlBar.tsx` - Input controls
- `InputBar.tsx` - Message input with voice support
- `SecurityConfirmModal.tsx` - Tool confirmation dialogs
- `Toast.tsx` - Notification system

### Hooks
- `useWebSocket.ts` - WebSocket connection management
- `useSpeechRecognition.ts` - Browser speech recognition
- `useWhisperRecognition.ts` - OpenAI Whisper integration
- `useWakeWord.ts` - Wake word detection
- `useTTS.ts` - Text-to-speech control
- `useAudioPlayback.ts` - Audio playback

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Web UI (React)                             │
│         Chat │ Tasks │ Workflows │ Schedule │ Settings              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                           WebSocket + REST
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js/TypeScript)                    │
├─────────────────┬───────────────┬───────────────┬───────────────────┤
│   Agent Runner  │   Providers   │   Scheduler   │     Server        │
│                 │               │               │                   │
│  - Session Mgmt │  - OpenAI     │  - Cron Jobs  │  - HTTP Routes    │
│  - Tool Parser  │  - Anthropic  │  - Storage    │  - WebSocket      │
│  - Security     │  - Ollama     │               │                   │
├─────────────────┴───────────────┴───────────────┴───────────────────┤
│                            Skills                                    │
│  File Ops │ Exec │ Web │ Memory │ Vision │ Audio │ Gmail │ Self-Cfg │
├─────────────────────────────────────────────────────────────────────┤
│                         Hardware Layer                               │
│              macOS │ Linux │ Windows Adapters                        │
├─────────────────────────────────────────────────────────────────────┤
│                          Memory Store                                │
│                    SQLite (Facts + Memories)                         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│   Telegram Bot    │  │   Voice Service   │  │  Prefect Bridge   │
│    (Grammy)       │  │   (Python/WSS)    │  │  (Python/FastAPI) │
│                   │  │                   │  │                   │
│  - Text Messages  │  │  - TTS (Kokoro)   │  │  - Workflows      │
│  - Photos/Voice   │  │  - Wake Word      │  │  - HTTP Requests  │
│  - Documents      │  │                   │  │  - Agent Prompts  │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## Configuration

### Environment Variables
```bash
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434

# Telegram
TELEGRAM_BOT_TOKEN=...

# Optional
VOICE_DISABLED=false
PREFECT_DISABLED=false
```

### Config File (`config.yaml`)
- Provider settings (API keys, models, base URLs)
- Agent settings (memory, personas, tools mode)
- Server settings (host, port)
- Telegram settings (bot token, allowed users)
- Gmail settings (credentials path)
- Hardware settings

---

## Dependencies

### Backend (Node.js)
- `@anthropic-ai/sdk` - Anthropic Claude API
- `openai` - OpenAI API
- `ollama` - Ollama local models
- `better-sqlite3` - SQLite storage
- `grammy` - Telegram bot
- `express` - HTTP server
- `ws` - WebSocket
- `node-cron` - Task scheduling
- `cheerio` - HTML parsing
- `execa` - Command execution
- `googleapis` - Gmail API

### Frontend (React)
- React 18 + TypeScript
- Vite build tool
- TailwindCSS styling
- react-markdown + remark plugins
- mermaid diagram rendering
- zustand state management

### Voice Service (Python)
- Kokoro TTS with MLX
- OpenWakeWord
- FastAPI + WebSocket
- NumPy

---

*Last updated: February 2026*
*All capabilities verified against source code implementation.*
