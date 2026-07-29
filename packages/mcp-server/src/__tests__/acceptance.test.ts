import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildAuthContext } from '../auth/identity.js';
import type { AuthPrincipal } from '../auth/token.js';
import { dispatchMcpRequest } from '../mcp/handler.js';
import type { JsonRpcSuccess } from '../mcp/jsonrpc.js';
import { toolRegistry } from '../tools/registry-instance.js';

/** The unified error taxonomy codes (spec §10.2). */
const TAXONOMY_CODES = new Set([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'UPSTREAM_ERROR',
  'TIMEOUT_ERROR',
  'RATE_LIMIT_ERROR',
  'INTERNAL_ERROR',
]);

/**
 * Final wiring audit (blueprint Prompt 24). Asserts the acceptance invariants:
 * every registered tool is reachable through the MCP dispatch, every one is
 * routed through the shared auth/policy/error/output frameworks (no bypass), and
 * the temporary smoke stub is gone (no dead module).
 */

/** A verified caller with no roles and no memberships. */
function noAccessAuth() {
  const principal: AuthPrincipal = {
    subject: 'user-audit',
    issuer: 'https://tenant.auth0.com/',
    audience: 'mcp-api',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-audit' },
  };
  return buildAuthContext(principal, []);
}

async function toolsList() {
  return (await dispatchMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { auth: noAccessAuth(), correlationId: 'audit' },
  )) as JsonRpcSuccess;
}

beforeAll(async () => {
  vi.stubEnv('MCP_PUBLIC_BASE_URL', 'https://mcp.example.com');
  vi.stubEnv('AUTH0_ISSUER_URL', 'https://tenant.auth0.com/');
  vi.stubEnv('AUTH0_AUDIENCE', 'mcp-api');
  vi.stubEnv('GRAPHQL_UPSTREAM_URL', 'http://localhost:4000/graphql');
  const { resetEnvCache } = await import('../config/env.js');
  resetEnvCache();
});

afterAll(async () => {
  const { resetEnvCache } = await import('../config/env.js');
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe('acceptance: final wiring audit', () => {
  it('exposes exactly the registered tools via tools/list — no orphans, no smoke stub', async () => {
    const res = await toolsList();
    const listed = (res.result as { tools: Array<{ name: string }> }).tools.map(t => t.name).sort();
    const registered = toolRegistry
      .list()
      .map(t => t.name)
      .sort();

    expect(registered.length).toBeGreaterThan(0);
    expect(listed).toEqual(registered);
    expect(listed).not.toContain('accounter_smoke_ping');
  });

  it('routes every registered tool through shared auth/policy/error/output (no bypass)', async () => {
    const auth = noAccessAuth();
    for (const tool of toolRegistry.list()) {
      const res = (await dispatchMcpRequest(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool.name, arguments: {} } },
        { auth, correlationId: 'audit' },
      )) as JsonRpcSuccess;

      // Reachable: dispatched to the executor (a success envelope with a tool
      // result), not an "Unknown tool" JSON-RPC error.
      expect(res.result).toBeDefined();
      const result = res.result as {
        isError?: boolean;
        content: Array<{ type: string }>;
        structuredContent?: { code?: string; correlationId?: string };
      };

      // Shared output framework: a text content block is always present.
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]?.type).toBe('text');

      // With no roles/memberships, no business-scoped tool can succeed: the
      // shared input-validation + authorization frameworks reject the call
      // (VALIDATION_ERROR or AUTHORIZATION_ERROR) BEFORE any upstream call, and
      // the shared error taxonomy shapes the result. A non-error result here
      // would mean a bypass around auth/policy.
      expect(result.isError).toBe(true);
      expect(TAXONOMY_CODES.has(result.structuredContent?.code ?? '')).toBe(true);
      expect(result.structuredContent?.correlationId).toBe('audit');
    }
  });

  it('every registered tool declares an authorization policy', () => {
    for (const tool of toolRegistry.list()) {
      expect(typeof tool.policy.requiresBusinessScope).toBe('boolean');
      expect(['public', 'business', 'sensitive']).toContain(tool.policy.dataClassification);
    }
  });

  it('the temporary smoke-stub module has been removed', async () => {
    await expect(import('../mcp/tools.js')).rejects.toThrow();
  });
});
