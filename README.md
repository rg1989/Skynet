# Skynet

A personal AI assistant with web UI, multiple LLM providers, tool execution, and persistent memory.

## Features

- **Multiple LLM Providers**: Ollama (local), OpenAI, and Anthropic
- **Web Dashboard**: Modern React UI with chat, session management, and settings
- **Tool System**: 25+ built-in skills including file operations, web browsing, command execution, and more
- **Persistent Memory**: SQLite-based memory with semantic search using embeddings
- **Session Management**: Multiple chat sessions with full history persistence
- **Real-time Updates**: WebSocket connection for live streaming responses
- **Scheduled Tasks**: Cron-based task scheduling

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Ollama (for local models) or API keys for OpenAI/Anthropic

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/skynet.git
cd skynet

# Install dependencies
npm install

# Install frontend dependencies
cd web && npm install && cd ..

# Build the frontend
npm run build:frontend
```

### Configuration

Skynet uses a JSON configuration file. Copy the example and customize:

```bash
cp skynet.config.json.example skynet.config.json
```

#### Configuration Options

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "providers": {
    "default": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2:latest"
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4o"
    },
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "model": "claude-sonnet-4-20250514"
    }
  },
  "agent": {
    "systemPrompt": "You are Skynet, a helpful personal AI assistant.",
    "maxTokens": 4096,
    "memory": {
      "enabled": true,
      "autoRemember": false
    }
  },
  "data": {
    "dataDir": "./data"
  }
}
```

### API Keys

You can configure API keys in two ways:

1. **Environment Variables** (recommended for security):
   ```bash
   export OPENAI_API_KEY="sk-..."
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

2. **Web UI**: Go to Settings and enter your API keys in the "API Keys" section.

### Running

#### Development Mode

Starts both backend and frontend with hot reload:

```bash
npm run dev
```

This runs:
- Backend at http://localhost:3000
- Frontend dev server at http://localhost:5173 (with proxy to backend)

#### Production Mode

```bash
# Build everything
npm run build

# Start the server
npm start
```

Access the web UI at http://localhost:3000

## Project Structure

```
skynet/
├── src/                  # Backend source code
│   ├── agent/           # Agent runner and context
│   ├── config/          # Configuration loading and runtime
│   ├── memory/          # SQLite memory store
│   ├── providers/       # LLM provider implementations
│   ├── scheduler/       # Cron task scheduler
│   ├── server/          # Express server and routes
│   ├── skills/          # Tool implementations
│   └── index.ts         # Entry point
├── web/                  # Frontend React app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   └── store/       # Zustand state management
│   └── dist/            # Built frontend (served by backend)
├── data/                 # Runtime data (sessions, memory)
└── skynet.config.json   # Configuration file
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both backend and frontend in development mode |
| `npm run dev:backend` | Start only the backend with hot reload |
| `npm run dev:frontend` | Start only the frontend dev server |
| `npm run build` | Build both frontend and backend |
| `npm run build:frontend` | Build only the frontend |
| `npm run build:backend` | Build only the backend |
| `npm start` | Start the production server |
| `npm run typecheck` | Run TypeScript type checking |

## API Endpoints

### Chat
- `POST /api/chat` - Send a message to the AI

### Sessions
- `GET /api/sessions` - List all chat sessions
- `GET /api/sessions/:key` - Get session history
- `DELETE /api/sessions/:key` - Delete a session

### Configuration
- `GET /api/providers` - List available providers
- `PUT /api/config/provider` - Change provider/model
- `GET /api/config/api-keys` - Get API key status
- `PUT /api/config/api-keys` - Update API keys

### Memory
- `GET /api/memory/facts` - List stored facts
- `GET /api/memory/search?q=query` - Search memories
- `GET /api/memory/stats` - Get memory statistics

### Tools
- `GET /api/tools` - List available tools
- `PUT /api/tools/:name` - Enable/disable a tool
- `PUT /api/config/tools-mode` - Set tools mode (hybrid/native/text/disabled)

## Providers

### Ollama (Default)
Local LLM running on your machine. No API key required.

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2
```

### OpenAI
Requires an API key from [platform.openai.com](https://platform.openai.com/api-keys)

Supported models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo

### Anthropic
Requires an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)

Supported models: claude-sonnet-4, claude-opus-4, claude-3.5-sonnet, claude-3-haiku

## License

MIT
