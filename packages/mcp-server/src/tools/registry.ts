import { z } from 'zod';
import type { AuthorizedReadScope, McpAuthContext } from '../auth/identity.js';
import type { UpstreamGraphQLClient } from '../upstream/graphql-client.js';

/**
 * Curated tool registry abstraction.
 *
 * Every exposed capability is a {@link ToolDefinition} with a strict input
 * schema, an authorization policy, and a pure handler. The registry supports
 * incremental registration and lookup, and provides strict input validation
 * with unknown-field rejection and a deterministic validation error payload.
 *
 * Authorization enforcement (the policy) and handler execution are wired in
 * later steps; this file defines the contracts and the validation layer.
 */

/** Data-sensitivity class of a tool's output (spec §9.4). */
export type DataClassification = 'public' | 'business' | 'sensitive';

/** Per-tool authorization policy (spec §7.2). Evaluated before execution. */
export interface ToolAuthPolicy {
  /** Roles/scopes the caller must hold (any-of). Empty/omitted ⇒ no role gate. */
  requiredRoles?: readonly string[];
  /** Whether the tool operates within the caller's business read scope. */
  requiresBusinessScope: boolean;
  /** Sensitivity of the data the tool returns. */
  dataClassification: DataClassification;
}

/** Context passed to a tool handler at execution time. */
export interface ToolExecutionContext {
  /** The authenticated caller and their memberships. */
  auth: McpAuthContext;
  /** Read scope resolved for this call (default or caller-narrowed). */
  readScope: AuthorizedReadScope;
  /** Correlation id for tracing/log/upstream propagation. */
  correlationId: string;
  /** Shared upstream GraphQL client for read-only operations. */
  client: UpstreamGraphQLClient;
  /** Caller's Authorization header, forwarded upstream (never logged). */
  authorization?: string;
}

export interface ToolTextContent {
  type: 'text';
  text: string;
}

/** MCP `tools/call` result. */
export interface ToolResult {
  content: ToolTextContent[];
  isError?: boolean;
  /** Optional machine-readable payload mirrored alongside the text content. */
  structuredContent?: unknown;
}

/** A zod object schema describing a tool's input. */
export type ToolInputSchema = z.ZodObject;

/** A registered, curated tool. Handlers must be pure and testable. */
export interface ToolDefinition<Schema extends ToolInputSchema = ToolInputSchema> {
  name: string;
  description: string;
  inputSchema: Schema;
  policy: ToolAuthPolicy;
  handler: (
    input: z.infer<Schema>,
    context: ToolExecutionContext,
  ) => Promise<ToolResult> | ToolResult;
}

/** Tool descriptor advertised by `tools/list` (JSON Schema for the input). */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export interface ToolValidationIssue {
  /** Dot-joined path to the offending field (empty for the root object). */
  path: string;
  message: string;
}

/** Deterministic validation error payload (spec §10.2 VALIDATION_ERROR). */
export interface ToolValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  issues: ToolValidationIssue[];
}

export type ToolInputValidation<T> =
  { ok: true; data: T } | { ok: false; error: ToolValidationError };

function toValidationError(error: z.ZodError): ToolValidationError {
  const issues = error.issues.map(issue => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid tool input',
    issues,
  };
}

/**
 * Validate raw tool-call arguments against a tool's schema. Unknown fields are
 * rejected (`.strict()`). Returns the parsed input or a deterministic error.
 */
export function validateToolInput<Schema extends ToolInputSchema>(
  tool: ToolDefinition<Schema>,
  rawArgs: unknown,
): ToolInputValidation<z.infer<Schema>> {
  const result = tool.inputSchema.strict().safeParse(rawArgs ?? {});
  if (result.success) {
    return { ok: true, data: result.data as z.infer<Schema> };
  }
  return { ok: false, error: toValidationError(result.error) };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Thrown when registering a tool whose name is already taken. */
export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(`A tool named "${name}" is already registered`);
    this.name = 'DuplicateToolError';
  }
}

/**
 * In-memory registry of curated tools. Registration order is preserved so
 * `list()`/`describe()` output is stable.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  /** Register a tool. Throws {@link DuplicateToolError} on a name collision. */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** All registered tools, in registration order. */
  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Descriptors for `tools/list`, with input schemas rendered to JSON Schema. */
  describe(): ToolDescriptor[] {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
    }));
  }
}
