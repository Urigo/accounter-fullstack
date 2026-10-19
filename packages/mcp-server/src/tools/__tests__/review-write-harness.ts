import { vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import type { ToolDefinition } from '../registry.js';

/**
 * Shared fixture for the review write tools (charges, transactions, documents,
 * businesses). Each is a single JSON mutation, so one capturing client serves
 * them all: it records the query, variables and headers sent, and answers with
 * whatever payload the test hands it under the mutation's root field.
 */

export const B1 = 'aa000000-0000-4000-8000-000000000001';
export const B2 = 'aa000000-0000-4000-8000-000000000002';
export const C1 = 'cc000000-0000-4000-8000-000000000001';
export const C2 = 'cc000000-0000-4000-8000-000000000002';
export const D1 = 'dd000000-0000-4000-8000-000000000001';
export const T1 = 'ee000000-0000-4000-8000-000000000001';
export const BIZ = 'bb000000-0000-4000-8000-000000000001';

export function authContext(memberBusinessIds: string[], roleId = 'accountant'): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
  );
}

export interface CapturedCall {
  query: string;
  variables: Record<string, unknown>;
  headers: Record<string, string>;
}

/** A client answering `{ data: { [rootField]: payload } }` to every call. */
export function mutationClient(rootField: string, payload: unknown, status = 200) {
  const captured: CapturedCall[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };
    captured.push({
      query: body.query,
      variables: body.variables,
      headers: init.headers as Record<string, string>,
    });
    return {
      ok: status < 400,
      status,
      json: async () => ({ data: { [rootField]: payload } }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, captured };
}

export function runTool(
  tool: ToolDefinition,
  rawArgs: unknown,
  client: UpstreamGraphQLClient,
  auth = authContext([B1]),
) {
  return executeRegisteredTool({
    tool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });
}

/** A charge echo in the shape the charge write mutations return. */
export function chargeEcho(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'CommonCharge',
    id: C1,
    userDescription: 'General banking fees',
    optionalDocuments: null,
    optionalVAT: null,
    counterparty: { id: BIZ, name: 'Poalim' },
    tags: [{ id: 'tag-1', name: 'financial' }],
    metadata: { transactionsCount: 2, documentsCount: 0, invalidLedger: 'VALID' },
    ...overrides,
  };
}
