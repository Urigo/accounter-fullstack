/**
 * Placeholder tool surface for the MCP transport skeleton.
 *
 * This file exists only to prove the list-tools / dispatch path end-to-end. It
 * exposes a single, clearly-marked internal smoke tool and NO production
 * capabilities. The curated, authorization-gated tool registry (with strict
 * input/output schemas) replaces this in later steps; the smoke tool is removed
 * or folded into that registry at wiring time.
 */

/** JSON Schema (draft-07 subset) describing a tool's input. */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/** MCP tool descriptor as returned by `tools/list`. */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

/** MCP `tools/call` result content block. */
export interface ToolTextContent {
  type: 'text';
  text: string;
}

export interface ToolCallResult {
  content: ToolTextContent[];
  isError?: boolean;
}

export const SMOKE_TOOL_NAME = 'accounter_smoke_ping';

export const smokeTool: ToolDescriptor = {
  name: SMOKE_TOOL_NAME,
  description:
    'Internal connectivity smoke test. Echoes the provided message back. Not a production capability — used only to verify the MCP transport is reachable.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Text to echo back.',
      },
    },
    additionalProperties: false,
  },
};

/** Tools advertised by `tools/list` in the current (skeleton) phase. */
export const listedTools: readonly ToolDescriptor[] = [smokeTool];

/** Execute the smoke tool. Pure and side-effect free — no upstream calls. */
export function runSmokeTool(args: unknown): ToolCallResult {
  const message =
    typeof args === 'object' &&
    args !== null &&
    typeof (args as { message?: unknown }).message === 'string'
      ? (args as { message: string }).message
      : '';
  return {
    content: [{ type: 'text', text: `pong: ${message}` }],
    isError: false,
  };
}
