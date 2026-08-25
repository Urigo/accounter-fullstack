import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listClientsTool, MAX_CLIENTS } from '../clients.js';
import { executeRegisteredTool } from '../execute.js';

function authContext(memberBusinessIds: string[]): McpAuthContext {
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
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown, capture?: (init: RequestInit) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(init);
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

// Always through `executeRegisteredTool`, never the handler directly, so input
// validation, the authorization policy and scope resolution are exercised too.
const runTool = (client: UpstreamGraphQLClient, auth: McpAuthContext, rawArgs: unknown) =>
  executeRegisteredTool({
    tool: listClientsTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

const NO_INTEGRATIONS = {
  hiveId: null,
  linearId: null,
  slackChannelKey: null,
  notionId: null,
  workflowyUrl: null,
  greenInvoiceInfo: null,
};

function rawClient(
  id: string,
  name: string,
  ownerId = 'b1',
  integrations: Record<string, unknown> = NO_INTEGRATIONS,
) {
  return {
    id,
    ownerId,
    emails: [],
    generatedDocumentType: 'PROFORMA',
    originalBusiness: { id, name },
    integrations,
  };
}

type ClientRow = {
  businessId: string;
  name: string;
  ownerId: string;
  emails: string[];
  generatedDocumentType: string;
  integrations: Record<string, string>;
};

const rowsOf = (result: { structuredContent?: unknown }) =>
  (result.structuredContent as { clients: ClientRow[] }).clients;

describe('listClientsTool', () => {
  const client = () =>
    clientReturning({
      allClients: [
        rawClient('3', 'Zebra'),
        rawClient('1', 'apple'),
        rawClient('2', 'Banana'),
      ],
    });

  it('returns clients sorted by name (case-insensitive), then business id', async () => {
    const result = await runTool(client(), authContext(['b1']), {});
    expect(rowsOf(result).map(c => c.name)).toEqual(['apple', 'Banana', 'Zebra']);
  });

  it('filters by nameContains (case-insensitive)', async () => {
    const result = await runTool(client(), authContext(['b1']), { nameContains: 'an' });
    const structured = result.structuredContent as { clients: ClientRow[]; totalCount: number };
    expect(structured.clients.map(c => c.name)).toEqual(['Banana']);
    expect(structured.totalCount).toBe(1);
  });

  it('filters by clientBusinessIds', async () => {
    const result = await runTool(client(), authContext(['b1']), { clientBusinessIds: ['1', '3'] });
    expect(rowsOf(result).map(c => c.businessId)).toEqual(['1', '3']);
  });

  it('emits the business id once, under businessId', async () => {
    const result = await runTool(client(), authContext(['b1']), { clientBusinessIds: ['1'] });
    const [row] = rowsOf(result);
    expect(row.businessId).toBe('1');
    // No second spelling of the same value — `Client.id` upstream *is* the
    // business id, and emitting both would imply two identifiers to track.
    expect(row).not.toHaveProperty('id');
  });

  it('echoes the effective scope and tags every row with ownerId', async () => {
    const result = await runTool(client(), authContext(['b1', 'b2']), {});
    const structured = result.structuredContent as {
      clients: ClientRow[];
      scope: { memberBusinessIds: string[] };
    };
    expect(structured.scope).toEqual({ memberBusinessIds: ['b1', 'b2'] });
    expect(structured.clients.every(c => c.ownerId === 'b1')).toBe(true);
  });

  // Defense in depth on top of RLS. Upstream should never return this row; if it
  // does — an RLS regression — the tool must not pass it on.
  it('drops a row whose ownerId is outside the resolved scope', async () => {
    const upstream = clientReturning({
      allClients: [rawClient('1', 'Mine', 'b1'), rawClient('2', 'Theirs', 'b-other')],
    });
    const result = await runTool(upstream, authContext(['b1']), {});
    expect(rowsOf(result).map(c => c.name)).toEqual(['Mine']);
  });

  it('omits unconfigured integrations and flattens the Green Invoice id', async () => {
    const upstream = clientReturning({
      allClients: [
        rawClient('1', 'Acme', 'b1', {
          hiveId: 'hive-1',
          linearId: null,
          slackChannelKey: 'C123',
          notionId: null,
          workflowyUrl: null,
          greenInvoiceInfo: { greenInvoiceId: 'gi-1' },
        }),
      ],
    });
    const result = await runTool(upstream, authContext(['b1']), {});
    // Exactly the configured three — absent, not null, for the rest.
    expect(rowsOf(result)[0].integrations).toEqual({
      greenInvoiceId: 'gi-1',
      hiveId: 'hive-1',
      slackChannelKey: 'C123',
    });
  });

  it('emits an empty integrations object when none are configured', async () => {
    const result = await runTool(client(), authContext(['b1']), { clientBusinessIds: ['1'] });
    expect(rowsOf(result)[0].integrations).toEqual({});
  });

  // A `greenInvoiceInfo` present but carrying a null id is "not configured", the
  // same as an absent wrapper — the two must not read differently.
  it('treats a null greenInvoiceId as unconfigured', async () => {
    const upstream = clientReturning({
      allClients: [
        rawClient('1', 'Acme', 'b1', { ...NO_INTEGRATIONS, greenInvoiceInfo: { greenInvoiceId: null } }),
      ],
    });
    const result = await runTool(upstream, authContext(['b1']), {});
    expect(rowsOf(result)[0].integrations).toEqual({});
  });

  it('caps the page at limit while totalCount still counts every match', async () => {
    const upstream = clientReturning({
      allClients: [rawClient('1', 'apple'), rawClient('2', 'Banana'), rawClient('3', 'Zebra')],
    });
    const result = await runTool(upstream, authContext(['b1']), { limit: 2 });
    const structured = result.structuredContent as {
      clients: ClientRow[];
      returnedCount: number;
      totalCount: number;
      truncated: boolean;
    };
    expect(structured.clients.map(c => c.name)).toEqual(['apple', 'Banana']);
    expect(structured.returnedCount).toBe(2);
    expect(structured.totalCount).toBe(3);
    expect(structured.truncated).toBe(true);
  });

  it('rejects a limit above the cap', async () => {
    const result = await runTool(client(), authContext(['b1']), { limit: MAX_CLIENTS + 1 });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('enforces business scope (denies a caller with no memberships)', async () => {
    const result = await runTool(client(), authContext([]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('rejects a memberBusinessId outside the caller memberships', async () => {
    const result = await runTool(client(), authContext(['b1']), {
      memberBusinessIds: ['not-mine'],
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('forwards the resolved scope upstream as x-business-scope', async () => {
    let sentInit: RequestInit | undefined;
    const upstream = clientReturning({ allClients: [] }, init => (sentInit = init));
    await runTool(upstream, authContext(['b1', 'b2']), { memberBusinessIds: ['b2'] });
    const headers = sentInit!.headers as Record<string, string>;
    expect(headers['x-business-scope']).toBe('b2');
  });

  /**
   * The reason this tool selects `greenInvoiceInfo { greenInvoiceId }` and
   * nothing else: every other field on `GreenInvoiceClient` is fetched from the
   * external Green Invoice API, one request per client. A future edit that adds
   * `name` or `emails` "for convenience" would turn one list call into N
   * third-party calls, and nothing else in the suite would notice.
   */
  it('selects only greenInvoiceId beneath greenInvoiceInfo', async () => {
    let sentInit: RequestInit | undefined;
    const upstream = clientReturning({ allClients: [] }, init => (sentInit = init));
    await runTool(upstream, authContext(['b1']), {});

    const { query } = JSON.parse(sentInit!.body as string) as { query: string };
    const nested = query.match(/greenInvoiceInfo\s*\{([^}]*)\}/);
    expect(nested).not.toBeNull();
    expect(nested![1]!.trim().split(/\s+/)).toEqual(['greenInvoiceId']);
  });

  it('reports no matches without erroring', async () => {
    const result = await runTool(clientReturning({ allClients: [] }), authContext(['b1']), {});
    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as { clients: ClientRow[]; totalCount: number };
    expect(structured.clients).toEqual([]);
    expect(structured.totalCount).toBe(0);
  });
});
