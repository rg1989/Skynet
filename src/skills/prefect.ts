import type { Skill, SkillResult } from '../types/index.js';

/**
 * Prefect workflow skills - create and manage complex multi-step workflows
 * 
 * These skills interact with the Prefect Bridge Server to:
 * - Create dynamic workflows with multiple steps
 * - Execute workflows with parameters
 * - Monitor workflow runs
 */

// Configuration - can be overridden via environment
const PREFECT_BRIDGE_URL = process.env.PREFECT_BRIDGE_URL || 'http://localhost:4201';

// API Response types
interface PrefectErrorResponse {
  detail?: string;
}

interface PrefectCreateFlowResponse extends PrefectErrorResponse {
  created?: boolean;
  flow?: string;
  steps?: number;
}

interface PrefectRunFlowResponse extends PrefectErrorResponse {
  id?: string;
  flow?: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
  result?: unknown;
}

interface PrefectListFlowsResponse extends PrefectErrorResponse {
  count?: number;
  flows?: Array<{ name: string; type: string; description: string }>;
}

interface PrefectGetRunsResponse extends PrefectErrorResponse {
  count?: number;
  runs?: Array<Record<string, unknown>>;
}

interface PrefectDeleteFlowResponse extends PrefectErrorResponse {
  deleted?: boolean;
  flow?: string;
}

/**
 * Check if Prefect bridge is available
 */
async function checkPrefectAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PREFECT_BRIDGE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const prefectCreateFlowSkill: Skill = {
  name: 'prefect_create_flow',
  description: `Create a new Prefect workflow for complex multi-step tasks. Use this for tasks that need:
- Multiple steps with dependencies
- Error handling and retries
- Integration with external APIs
- Sending prompts back to the AI agent as part of the workflow

Supported step actions:
- "agent_prompt": Send a prompt to Skynet (params: prompt, session_key)
- "http_request": Make HTTP request (params: method, url, headers, body)
- "delay": Wait for seconds (params: seconds)`,
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Unique name for the workflow (e.g., "daily_report_pipeline", "data_sync_workflow")',
      },
      description: {
        type: 'string',
        description: 'Description of what the workflow does',
      },
      steps: {
        type: 'string',
        description: 'JSON array of steps. Each step: {name, action, params, dependencies}. Example: [{"name":"fetch","action":"http_request","params":{"url":"https://api.example.com"}}]',
      },
    },
    required: ['name', 'description', 'steps'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const { name, description, steps: stepsJson } = params as {
      name: string;
      description: string;
      steps: string;
    };

    // Check if Prefect is available
    const available = await checkPrefectAvailable();
    if (!available) {
      return {
        success: false,
        error: `Prefect Bridge is not available at ${PREFECT_BRIDGE_URL}. Please start the Prefect server first (cd prefect && python server.py)`,
      };
    }

    // Parse steps JSON
    let steps: unknown[];
    try {
      steps = JSON.parse(stepsJson);
      if (!Array.isArray(steps)) {
        throw new Error('Steps must be an array');
      }
    } catch (e) {
      return {
        success: false,
        error: `Invalid steps JSON: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    try {
      const response = await fetch(`${PREFECT_BRIDGE_URL}/flows/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, steps }),
      });

      const data = await response.json() as PrefectCreateFlowResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || `Failed to create flow: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          created: data.created,
          flow: data.flow,
          steps: data.steps,
          message: `Workflow "${name}" created successfully with ${steps.length} steps. Run it with prefect_run_flow.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const prefectRunFlowSkill: Skill = {
  name: 'prefect_run_flow',
  description: 'Execute a Prefect workflow by name. The workflow will run asynchronously and you can check status with prefect_get_runs.',
  parameters: {
    type: 'object',
    properties: {
      flow_name: {
        type: 'string',
        description: 'Name of the workflow to run',
      },
      parameters: {
        type: 'string',
        description: 'Optional JSON object of parameters to pass to the workflow. Example: {"data_url":"https://example.com/data.json"}',
      },
    },
    required: ['flow_name'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const { flow_name, parameters: paramsJson } = params as {
      flow_name: string;
      parameters?: string;
    };

    // Check if Prefect is available
    const available = await checkPrefectAvailable();
    if (!available) {
      return {
        success: false,
        error: `Prefect Bridge is not available at ${PREFECT_BRIDGE_URL}. Please start the Prefect server first.`,
      };
    }

    // Parse parameters if provided
    let flowParams = {};
    if (paramsJson) {
      try {
        flowParams = JSON.parse(paramsJson);
      } catch (e) {
        return {
          success: false,
          error: `Invalid parameters JSON: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }

    try {
      const response = await fetch(`${PREFECT_BRIDGE_URL}/flows/${encodeURIComponent(flow_name)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: flowParams }),
      });

      const data = await response.json() as PrefectRunFlowResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || `Failed to run flow: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          run_id: data.id,
          flow: data.flow,
          status: data.status,
          started_at: data.started_at,
          ended_at: data.ended_at,
          result: data.result,
          message: `Workflow "${flow_name}" ${data.status}. Run ID: ${data.id}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const prefectListFlowsSkill: Skill = {
  name: 'prefect_list_flows',
  description: 'List all available Prefect workflows, both from Python files and dynamically created ones.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(_params, _context): Promise<SkillResult> {
    // Check if Prefect is available
    const available = await checkPrefectAvailable();
    if (!available) {
      return {
        success: false,
        error: `Prefect Bridge is not available at ${PREFECT_BRIDGE_URL}. Please start the Prefect server first.`,
      };
    }

    try {
      const response = await fetch(`${PREFECT_BRIDGE_URL}/flows`);
      const data = await response.json() as PrefectListFlowsResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || `Failed to list flows: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          count: data.count,
          flows: data.flows,
          message: (data.count ?? 0) > 0
            ? `Found ${data.count} workflow(s) available.`
            : 'No workflows found. Create one with prefect_create_flow.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const prefectGetRunsSkill: Skill = {
  name: 'prefect_get_runs',
  description: 'Get recent workflow run history to see status and results of executed workflows.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of runs to return (default 10)',
      },
    },
  },
  async execute(params, _context): Promise<SkillResult> {
    const { limit } = params as { limit?: number };

    // Check if Prefect is available
    const available = await checkPrefectAvailable();
    if (!available) {
      return {
        success: false,
        error: `Prefect Bridge is not available at ${PREFECT_BRIDGE_URL}. Please start the Prefect server first.`,
      };
    }

    try {
      const url = new URL(`${PREFECT_BRIDGE_URL}/runs`);
      if (limit) {
        url.searchParams.set('limit', String(limit));
      }

      const response = await fetch(url.toString());
      const data = await response.json() as PrefectGetRunsResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || `Failed to get runs: ${response.statusText}`,
        };
      }

      const runs = data.runs ?? [];
      const count = data.count ?? 0;

      return {
        success: true,
        data: {
          total_runs: count,
          runs: runs.map((run: Record<string, unknown>) => ({
            id: run.id,
            flow: run.flow,
            status: run.status,
            started_at: run.started_at,
            ended_at: run.ended_at,
            error: run.error,
          })),
          message: count > 0
            ? `${runs.length} recent run(s) shown (${count} total).`
            : 'No workflow runs yet.',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const prefectDeleteFlowSkill: Skill = {
  name: 'prefect_delete_flow',
  description: 'Delete a dynamically created workflow. Note: This only works for flows created via prefect_create_flow, not Python file-based flows.',
  parameters: {
    type: 'object',
    properties: {
      flow_name: {
        type: 'string',
        description: 'Name of the workflow to delete',
      },
    },
    required: ['flow_name'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const { flow_name } = params as { flow_name: string };

    // Check if Prefect is available
    const available = await checkPrefectAvailable();
    if (!available) {
      return {
        success: false,
        error: `Prefect Bridge is not available at ${PREFECT_BRIDGE_URL}. Please start the Prefect server first.`,
      };
    }

    try {
      const response = await fetch(`${PREFECT_BRIDGE_URL}/flows/${encodeURIComponent(flow_name)}`, {
        method: 'DELETE',
      });

      const data = await response.json() as PrefectDeleteFlowResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || `Failed to delete flow: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: {
          deleted: true,
          flow: flow_name,
          message: `Workflow "${flow_name}" deleted successfully.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const prefectSkills = [
  prefectCreateFlowSkill,
  prefectRunFlowSkill,
  prefectListFlowsSkill,
  prefectGetRunsSkill,
  prefectDeleteFlowSkill,
];
