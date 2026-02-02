# Skynet Makefile
# Usage: make start (or just: make)

# Configuration
PORT ?= 3000
PREFECT_PORT ?= 4201
VOICE_PORT ?= 4202

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: all start stop build clean dev setup check-ports kill-ports help prefect-setup voice-setup status logs rebuild

# Default target
all: start

# Main start command - stops existing, builds, and starts fresh
start: stop prefect-setup voice-setup build run

# Just run without building (faster restart)
run:
	@echo "$(GREEN)Starting Skynet...$(NC)"
	@npm start

# Development mode with hot reload
dev: stop prefect-setup voice-setup
	@echo "$(GREEN)Starting Skynet in development mode...$(NC)"
	@npm run dev

# Build the project
build:
	@echo "$(GREEN)Building Skynet...$(NC)"
	@npm run build

# Stop any existing instances
stop: kill-ports
	@echo "$(GREEN)Stopped any existing Skynet instances$(NC)"

# Check which ports are in use
check-ports:
	@echo "$(YELLOW)Checking ports $(PORT), $(PREFECT_PORT), and $(VOICE_PORT)...$(NC)"
	@lsof -ti:$(PORT) >/dev/null 2>&1 && echo "  Port $(PORT): IN USE (PID: $$(lsof -ti:$(PORT)))" || echo "  Port $(PORT): available"
	@lsof -ti:$(PREFECT_PORT) >/dev/null 2>&1 && echo "  Port $(PREFECT_PORT): IN USE (PID: $$(lsof -ti:$(PREFECT_PORT)))" || echo "  Port $(PREFECT_PORT): available"
	@lsof -ti:$(VOICE_PORT) >/dev/null 2>&1 && echo "  Port $(VOICE_PORT): IN USE (PID: $$(lsof -ti:$(VOICE_PORT)))" || echo "  Port $(VOICE_PORT): available"

# Kill processes on required ports
kill-ports:
	@echo "$(YELLOW)Checking for processes on ports $(PORT), $(PREFECT_PORT), and $(VOICE_PORT)...$(NC)"
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "  Killing process on port $(PORT) (PID: $$(lsof -ti:$(PORT)))"; \
		lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@if lsof -ti:$(PREFECT_PORT) >/dev/null 2>&1; then \
		echo "  Killing process on port $(PREFECT_PORT) (PID: $$(lsof -ti:$(PREFECT_PORT)))"; \
		lsof -ti:$(PREFECT_PORT) | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@if lsof -ti:$(VOICE_PORT) >/dev/null 2>&1; then \
		echo "  Killing process on port $(VOICE_PORT) (PID: $$(lsof -ti:$(VOICE_PORT)))"; \
		lsof -ti:$(VOICE_PORT) | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi

# Clean build artifacts
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf dist/
	@rm -rf web/dist/
	@echo "$(GREEN)Clean complete$(NC)"

# Full clean and rebuild
rebuild: clean build

# Initial setup (install dependencies)
setup:
	@echo "$(GREEN)Setting up Skynet...$(NC)"
	@npm install
	@cd web && npm install
	@$(MAKE) prefect-setup
	@$(MAKE) voice-setup
	@echo "$(GREEN)Setup complete!$(NC)"

# Setup Prefect environment
prefect-setup:
	@echo "$(GREEN)Setting up Prefect...$(NC)"
	@if [ ! -d "prefect/venv" ]; then \
		cd prefect && python3 -m venv venv && \
		. venv/bin/activate && \
		pip install -r requirements.txt; \
		echo "$(GREEN)Prefect setup complete$(NC)"; \
	else \
		echo "  Prefect venv already exists"; \
	fi

# Setup Voice service environment (TTS and Wake Word)
# Requires Python 3.10+ for Kokoro TTS
# Tries python3.12, python3.11, python3.10, then falls back to python3
voice-setup:
	@echo "$(GREEN)Setting up Voice service...$(NC)"
	@if [ -d "voice/venv" ]; then \
		echo "  Voice venv already exists"; \
	else \
		PYTHON_CMD=""; \
		for py in python3.12 python3.11 python3.10; do \
			if command -v $$py >/dev/null 2>&1; then \
				PYTHON_CMD=$$py; \
				break; \
			fi; \
		done; \
		if [ -z "$$PYTHON_CMD" ]; then \
			PY_MINOR=$$(python3 -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo "0"); \
			if [ "$$PY_MINOR" -ge 10 ]; then \
				PYTHON_CMD=python3; \
			fi; \
		fi; \
		if [ -z "$$PYTHON_CMD" ]; then \
			echo "  $(YELLOW)Voice service requires Python 3.10+ - skipping$(NC)"; \
		else \
			echo "  Using $$PYTHON_CMD for voice service..."; \
			cd voice && $$PYTHON_CMD -m venv venv && \
			. venv/bin/activate && \
			pip install --upgrade pip && \
			pip install . && \
			echo "$(GREEN)  Voice service setup complete$(NC)"; \
		fi; \
	fi

# Show status of the app
status:
	@echo "$(YELLOW)Skynet Status:$(NC)"
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "  $(GREEN)Main server: Running on port $(PORT) (PID: $$(lsof -ti:$(PORT)))$(NC)"; \
	else \
		echo "  $(RED)Main server: Not running$(NC)"; \
	fi
	@if lsof -ti:$(PREFECT_PORT) >/dev/null 2>&1; then \
		echo "  $(GREEN)Prefect bridge: Running on port $(PREFECT_PORT) (PID: $$(lsof -ti:$(PREFECT_PORT)))$(NC)"; \
	else \
		echo "  $(RED)Prefect bridge: Not running$(NC)"; \
	fi
	@if lsof -ti:$(VOICE_PORT) >/dev/null 2>&1; then \
		echo "  $(GREEN)Voice service: Running on port $(VOICE_PORT) (PID: $$(lsof -ti:$(VOICE_PORT)))$(NC)"; \
	else \
		echo "  $(RED)Voice service: Not running$(NC)"; \
	fi

# Show logs (if using pm2 or similar)
logs:
	@echo "$(YELLOW)Tailing Skynet logs...$(NC)"
	@tail -f data/sessions/*.jsonl 2>/dev/null || echo "No session logs found"

# Help
help:
	@echo "$(GREEN)Skynet Makefile Commands:$(NC)"
	@echo ""
	@echo "  $(YELLOW)make$(NC) or $(YELLOW)make start$(NC)  - Stop existing, build, and start fresh"
	@echo "  $(YELLOW)make run$(NC)           - Start without building (faster)"
	@echo "  $(YELLOW)make dev$(NC)           - Start in development mode with hot reload"
	@echo "  $(YELLOW)make build$(NC)         - Build the project"
	@echo "  $(YELLOW)make stop$(NC)          - Stop any running instances"
	@echo "  $(YELLOW)make status$(NC)        - Check if Skynet is running"
	@echo "  $(YELLOW)make check-ports$(NC)   - Check if required ports are available"
	@echo "  $(YELLOW)make clean$(NC)         - Remove build artifacts"
	@echo "  $(YELLOW)make rebuild$(NC)       - Clean and rebuild"
	@echo "  $(YELLOW)make setup$(NC)         - Initial setup (install all dependencies)"
	@echo "  $(YELLOW)make prefect-setup$(NC) - Setup Prefect virtual environment"
	@echo "  $(YELLOW)make voice-setup$(NC)   - Setup Voice service (TTS & Wake Word)"
	@echo "  $(YELLOW)make help$(NC)          - Show this help message"
	@echo ""
	@echo "$(GREEN)Options:$(NC)"
	@echo "  PORT=3001 make start     - Use a different main port"
	@echo "  PREFECT_PORT=4202 make   - Use a different Prefect port"
	@echo "  VOICE_PORT=4203 make     - Use a different Voice service port"
