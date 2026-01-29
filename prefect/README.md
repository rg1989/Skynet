# Prefect Integration

This directory contains the Prefect workflow orchestration integration for Skynet.

## Setup

1. Create a Python virtual environment:
   ```bash
   cd prefect
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running

### Option 1: Bridge Server Only (Lightweight)

For simple workflow execution without the full Prefect UI:

```bash
cd prefect
source venv/bin/activate
python server.py
```

The bridge server runs on port 4201 and provides:
- `GET /health` - Health check
- `GET /flows` - List available flows
- `POST /flows/create` - Create dynamic flows
- `POST /flows/{name}/run` - Run a flow
- `GET /runs` - List recent runs

### Option 2: Full Prefect Server (Recommended for Production)

For the full Prefect experience with the beautiful web UI:

```bash
# Terminal 1: Start Prefect Server
prefect server start

# Terminal 2: Start Bridge Server  
python server.py
```

Prefect UI will be available at: http://localhost:4200

## Creating Flows

### Python Files

Create Python files in the `flows/` directory. Use the `@flow` and `@task` decorators:

```python
from prefect import flow, task

@task
def my_task(data):
    return process(data)

@flow
def my_flow(input_param: str):
    result = my_task(input_param)
    return result
```

### Dynamic Flows (via API)

Create flows dynamically through the Skynet agent:

```json
{
  "name": "my_workflow",
  "description": "A workflow that does X",
  "steps": [
    {
      "name": "fetch_data",
      "action": "http_request",
      "params": {"method": "GET", "url": "https://api.example.com/data"}
    },
    {
      "name": "process_with_ai",
      "action": "agent_prompt", 
      "params": {"prompt": "Analyze this data: $data"}
    }
  ]
}
```

### Supported Step Actions

- `agent_prompt` - Send a prompt to Skynet agent
- `http_request` - Make an HTTP request
- `delay` - Wait for specified seconds

## Integration with Skynet

The AI agent can create and run flows using these skills:
- `prefect_create_flow` - Create a new workflow
- `prefect_run_flow` - Execute a workflow
- `prefect_list_flows` - List available workflows
- `prefect_get_runs` - View run history
