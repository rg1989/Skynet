"""
Prefect Bridge Server

A FastAPI server that bridges Skynet (TypeScript) with Prefect (Python).
Exposes REST endpoints for creating, running, and monitoring Prefect flows.

Run with: uvicorn server:app --host 0.0.0.0 --port 4201
(Port 4200 is reserved for Prefect UI)
"""

import os
import sys
import json
import asyncio
import importlib.util
from pathlib import Path
from typing import Optional, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx


# Add flows directory to path
FLOWS_DIR = Path(__file__).parent / "flows"
sys.path.insert(0, str(FLOWS_DIR.parent))


app = FastAPI(
    title="Prefect Bridge",
    description="Bridge server connecting Skynet to Prefect workflows",
    version="1.0.0"
)

# CORS for Skynet frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory storage for dynamic flows and run history
# In production, Prefect Server handles this
dynamic_flows: dict[str, dict] = {}
run_history: list[dict] = []


class FlowDefinition(BaseModel):
    """Definition for creating a new flow dynamically."""
    name: str
    description: str
    steps: list[dict]  # [{name, action, params, dependencies}]


class FlowRunRequest(BaseModel):
    """Request to run a flow."""
    parameters: Optional[dict] = None


class AgentPromptStep(BaseModel):
    """A step that sends a prompt to Skynet agent."""
    prompt: str
    session_key: Optional[str] = None


# ============================================================================
# Flow Discovery
# ============================================================================

def discover_flows() -> dict[str, dict]:
    """Discover all flow files in the flows directory."""
    flows = {}
    
    for py_file in FLOWS_DIR.glob("*.py"):
        if py_file.name.startswith("_"):
            continue
            
        module_name = py_file.stem
        
        try:
            spec = importlib.util.spec_from_file_location(module_name, py_file)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Find flow-decorated functions
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if hasattr(attr, "__prefect_flow__") or (
                        callable(attr) and hasattr(attr, "fn")
                    ):
                        flow_name = getattr(attr, "name", attr_name)
                        flows[flow_name] = {
                            "name": flow_name,
                            "file": str(py_file),
                            "function": attr_name,
                            "module": module_name,
                            "description": attr.__doc__ or "No description",
                            "callable": attr,
                        }
        except Exception as e:
            print(f"Error loading {py_file}: {e}")
    
    return flows


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/flows")
async def list_flows():
    """List all available flows (both file-based and dynamic)."""
    discovered = discover_flows()
    
    all_flows = []
    
    # Add discovered flows
    for name, info in discovered.items():
        all_flows.append({
            "name": name,
            "type": "file",
            "description": info["description"][:200],
            "file": info["file"],
        })
    
    # Add dynamic flows
    for name, info in dynamic_flows.items():
        all_flows.append({
            "name": name,
            "type": "dynamic",
            "description": info["description"],
            "steps": len(info["steps"]),
        })
    
    return {"flows": all_flows, "count": len(all_flows)}


@app.post("/flows/create")
async def create_flow(definition: FlowDefinition):
    """
    Create a new dynamic flow from a definition.
    
    Dynamic flows are stored in memory and can execute sequences of steps
    including agent prompts, HTTP requests, and shell commands.
    """
    if definition.name in dynamic_flows:
        raise HTTPException(400, f"Flow '{definition.name}' already exists")
    
    dynamic_flows[definition.name] = {
        "name": definition.name,
        "description": definition.description,
        "steps": definition.steps,
        "created_at": datetime.now().isoformat(),
    }
    
    return {
        "created": True,
        "flow": definition.name,
        "steps": len(definition.steps),
    }


@app.post("/flows/{flow_name}/run")
async def run_flow(flow_name: str, request: FlowRunRequest):
    """Run a flow by name with optional parameters."""
    
    # Check dynamic flows first
    if flow_name in dynamic_flows:
        return await run_dynamic_flow(flow_name, request.parameters or {})
    
    # Check discovered flows
    discovered = discover_flows()
    if flow_name in discovered:
        return await run_discovered_flow(discovered[flow_name], request.parameters or {})
    
    raise HTTPException(404, f"Flow '{flow_name}' not found")


async def run_dynamic_flow(flow_name: str, parameters: dict) -> dict:
    """Execute a dynamically created flow."""
    flow_def = dynamic_flows[flow_name]
    
    run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{flow_name}"
    results = []
    
    run_record = {
        "id": run_id,
        "flow": flow_name,
        "type": "dynamic",
        "started_at": datetime.now().isoformat(),
        "parameters": parameters,
        "status": "running",
        "results": results,
    }
    run_history.append(run_record)
    
    try:
        for i, step in enumerate(flow_def["steps"]):
            step_name = step.get("name", f"step_{i}")
            action = step.get("action", "unknown")
            step_params = step.get("params", {})
            
            # Merge with flow parameters
            for key, value in step_params.items():
                if isinstance(value, str) and value.startswith("$"):
                    param_name = value[1:]
                    if param_name in parameters:
                        step_params[key] = parameters[param_name]
            
            step_result = {
                "step": step_name,
                "action": action,
                "started_at": datetime.now().isoformat(),
            }
            
            try:
                if action == "agent_prompt":
                    result = await execute_agent_prompt(step_params)
                elif action == "http_request":
                    result = await execute_http_request(step_params)
                elif action == "delay":
                    await asyncio.sleep(step_params.get("seconds", 1))
                    result = {"delayed": step_params.get("seconds", 1)}
                else:
                    result = {"skipped": True, "reason": f"Unknown action: {action}"}
                
                step_result["result"] = result
                step_result["status"] = "success"
            except Exception as e:
                step_result["error"] = str(e)
                step_result["status"] = "error"
            
            step_result["ended_at"] = datetime.now().isoformat()
            results.append(step_result)
        
        run_record["status"] = "completed"
        run_record["ended_at"] = datetime.now().isoformat()
        
    except Exception as e:
        run_record["status"] = "failed"
        run_record["error"] = str(e)
        run_record["ended_at"] = datetime.now().isoformat()
    
    return run_record


async def run_discovered_flow(flow_info: dict, parameters: dict) -> dict:
    """Execute a flow discovered from Python files."""
    run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{flow_info['name']}"
    
    run_record = {
        "id": run_id,
        "flow": flow_info["name"],
        "type": "file",
        "started_at": datetime.now().isoformat(),
        "parameters": parameters,
        "status": "running",
    }
    run_history.append(run_record)
    
    try:
        # Run the flow function
        flow_fn = flow_info["callable"]
        
        # Check if it's async
        if asyncio.iscoroutinefunction(flow_fn):
            result = await flow_fn(**parameters)
        else:
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: flow_fn(**parameters))
        
        run_record["result"] = _serialize_result(result)
        run_record["status"] = "completed"
        
    except Exception as e:
        run_record["status"] = "failed"
        run_record["error"] = str(e)
    
    run_record["ended_at"] = datetime.now().isoformat()
    return run_record


def _serialize_result(result: Any) -> Any:
    """Serialize a result to JSON-compatible format."""
    if result is None:
        return None
    if isinstance(result, (str, int, float, bool)):
        return result
    if isinstance(result, dict):
        return {k: _serialize_result(v) for k, v in result.items()}
    if isinstance(result, (list, tuple)):
        return [_serialize_result(v) for v in result]
    return str(result)


async def execute_agent_prompt(params: dict) -> dict:
    """Execute a step that sends a prompt to Skynet agent."""
    prompt = params.get("prompt", "")
    skynet_url = params.get("skynet_url", "http://localhost:3000")
    session_key = params.get("session_key", "prefect-flow")
    
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{skynet_url}/api/chat",
            json={
                "message": prompt,
                "sessionKey": session_key,
            }
        )
        response.raise_for_status()
        return response.json()


async def execute_http_request(params: dict) -> dict:
    """Execute an HTTP request step."""
    method = params.get("method", "GET").upper()
    url = params.get("url", "")
    headers = params.get("headers", {})
    body = params.get("body")
    
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.request(
            method=method,
            url=url,
            headers=headers,
            json=body if body else None,
        )
        
        return {
            "status_code": response.status_code,
            "body": response.text[:1000],
        }


@app.get("/runs")
async def list_runs(limit: int = 20):
    """Get recent flow runs."""
    return {
        "runs": run_history[-limit:][::-1],  # Most recent first
        "count": len(run_history),
    }


@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get details of a specific run."""
    for run in run_history:
        if run["id"] == run_id:
            return run
    raise HTTPException(404, f"Run '{run_id}' not found")


@app.delete("/flows/{flow_name}")
async def delete_flow(flow_name: str):
    """Delete a dynamic flow."""
    if flow_name not in dynamic_flows:
        raise HTTPException(404, f"Dynamic flow '{flow_name}' not found")
    
    del dynamic_flows[flow_name]
    return {"deleted": True, "flow": flow_name}


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PREFECT_BRIDGE_PORT", 4201))
    
    print(f"Starting Prefect Bridge Server on port {port}")
    print(f"Flows directory: {FLOWS_DIR}")
    print("Endpoints:")
    print(f"  - GET  /health")
    print(f"  - GET  /flows")
    print(f"  - POST /flows/create")
    print(f"  - POST /flows/{{name}}/run")
    print(f"  - GET  /runs")
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=port)
