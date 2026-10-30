import { describe, expect, it, vi } from 'vitest';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { createClientTool } from '../clients-write.js';
import {
  authContext,
  B1,
  B2,
  BIZ,
  callsTo,
  mutationClient,
  rootFields,
  runTool,
} from './review-write-harness.js';

const NAME = 'Acme Learning Ltd.';
const EMAILS = ['billing@acme.example', 'ops@acme.example'];

/** What `client(businessId:)` returns once the Green Invoice step has run. */
const readBack = (overrides: Record<string, unknown> = {}) => ({
  id: BIZ,
  ownerId: B1,
  emails: EMAILS,
  generatedDocumentType: 'PROFORMA',
  originalBusiness: { id: BIZ, name: NAME },
  integrations: {
    hiveId: null,
    linearId: null,
    slackChannelKey: null,
    notionId: null,
    workflowyUrl: null,
    greenInvoiceInfo: { greenInvoiceId: 'gi-1' },
  },
  ...overrides,
});

/** A directory row for a business that is not (yet) a client. */
const notAClient = { id: BIZ, name: NAME, isClient: false, clientInfo: null };

/**
 * The directory lookup finds a business that is not yet a client; the insert
 * succeeds and — as upstream really does — returns the row before the Green
 * Invoice id is written; the read-back then carries it.
 */
const fresh = (readBackOverrides: Record<string, unknown> = {}) =>
  mutationClient({
    businesses: [notAClient],
    insertClient: { __typename: 'Client', id: BIZ },
    client: readBack(readBackOverrides),
  });

/** An upstream that answers every operation with a GraphQL error, as the server does for an unknown id. */
function erroringClient(message: string) {
  const captured: string[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    captured.push((JSON.parse(init.body as string) as { query: string }).query);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: null, errors: [{ message }] }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, captured };
}

const minimal = { businessId: BIZ, generatedDocumentType: 'PROFORMA' };

describe('createClientTool — request', () => {
  it('reads the business, sends the given fields, then reads the client back', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { ...minimal, emails: EMAILS, integrations: { hiveId: 'hive-org-1' } },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(rootFields(captured)).toEqual(['businesses', 'insertClient', 'client']);
    const [lookup] = callsTo(captured, 'businesses');
    expect(lookup.query).toMatch(/^\s*query\b/);
    expect(lookup.variables).toEqual({ ids: [BIZ] });
    const [insert] = callsTo(captured, 'insertClient');
    expect(insert.query).toMatch(/^\s*mutation\b/);
    expect(insert.variables).toEqual({
      fields: {
        businessId: BIZ,
        generatedDocumentType: 'PROFORMA',
        emails: EMAILS,
        integrations: { hiveId: 'hive-org-1' },
      },
    });
    expect(insert.headers['x-business-scope']).toBe(B1);
    const [read] = callsTo(captured, 'client');
    expect(read.query).toMatch(/^\s*query\b/);
    expect(read.variables).toEqual({ businessId: BIZ });
  });

  it('omits emails and integrations when not given, so upstream applies its own defaults', async () => {
    const { client, captured } = fresh();
    await runTool(createClientTool, { businessId: BIZ, generatedDocumentType: 'INVOICE' }, client);

    const [insert] = callsTo(captured, 'insertClient');
    expect(insert.variables).toEqual({
      fields: { businessId: BIZ, generatedDocumentType: 'INVOICE' },
    });
  });
});

describe('createClientTool — guards', () => {
  it('rejects a document type outside the DocumentType enum before any round trip', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'QUOTE' },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; issues?: Array<{ path: string }> };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.issues?.[0]?.path).toBe('generatedDocumentType');
    expect(captured).toHaveLength(0);
  });

  it('rejects a malformed email before any round trip', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { ...minimal, emails: ['billing@acme.example', 'not-an-email'] },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; issues?: Array<{ path: string }> };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.issues?.[0]?.path).toBe('emails.1');
    expect(captured).toHaveLength(0);
  });

  it('does not accept a Green Invoice id — upstream assigns that itself', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { ...minimal, integrations: { greenInvoiceId: 'gi-x' } },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('refuses a business that is already a client and points at accounter_list_clients', async () => {
    const { client, captured } = mutationClient({
      businesses: [
        {
          id: BIZ,
          name: NAME,
          isClient: true,
          clientInfo: { integrations: { greenInvoiceInfo: { greenInvoiceId: 'gi-1' } } },
        },
      ],
      insertClient: { __typename: 'Client', id: BIZ },
    });
    const result = await runTool(createClientTool, minimal, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/already a client$/);
    expect(structured.issues[0].path).toBe('businessId');
    expect(structured.issues[0].message).toContain('accounter_list_clients');
    expect(callsTo(captured, 'insertClient')).toHaveLength(0);
  });

  it('names a half-created client (row without a Green Invoice customer) instead of calling it done', async () => {
    const { client, captured } = mutationClient({
      businesses: [
        { id: BIZ, name: NAME, isClient: true, clientInfo: { integrations: { greenInvoiceInfo: null } } },
      ],
      insertClient: { __typename: 'Client', id: BIZ },
    });
    const result = await runTool(createClientTool, minimal, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/already a client but its Green Invoice customer is missing/);
    expect(structured.issues[0].message).toContain('Accounter UI');
    expect(callsTo(captured, 'insertClient')).toHaveLength(0);
  });

  it('turns the upstream error for an unknown business id into a validation error', async () => {
    // `businesses(ids:)` does not return a shorter list for a missing id — it
    // throws, and this is the message it throws with.
    const { client, captured } = erroringClient('Error fetching some of the businesses');
    const result = await runTool(createClientTool, minimal, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toContain(BIZ);
    expect(structured.issues[0].path).toBe('businessId');
    expect(captured).toHaveLength(1); // the pre-read only; no mutation followed
  });

  it('passes any other upstream error on the pre-read through unchanged', async () => {
    const { client } = erroringClient('Context creation failed');
    const result = await runTool(createClientTool, minimal, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('UPSTREAM_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = fresh();
    const result = await runTool(createClientTool, minimal, client, authContext([B1, B2]));

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('createClientTool — result mapping', () => {
  it('reports the client from the read-back, including the Green Invoice id upstream assigned', async () => {
    const { client } = fresh({
      integrations: {
        hiveId: 'hive-org-1',
        linearId: null,
        slackChannelKey: null,
        notionId: null,
        workflowyUrl: null,
        greenInvoiceInfo: { greenInvoiceId: 'gi-1' },
      },
    });
    const result = await runTool(
      createClientTool,
      { ...minimal, emails: EMAILS, integrations: { hiveId: 'hive-org-1' } },
      client,
    );

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      clientBusinessId: string;
      greenInvoiceId: string | null;
      setFields: string[];
      clients: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('create_client');
    expect(structured.clientBusinessId).toBe(BIZ);
    expect(structured.greenInvoiceId).toBe('gi-1');
    expect(structured.setFields).toEqual([
      'businessId',
      'generatedDocumentType',
      'emails',
      'integrations',
    ]);
    expect(structured.clients).toEqual([
      {
        businessId: BIZ,
        name: NAME,
        ownerId: B1,
        emails: EMAILS,
        generatedDocumentType: 'PROFORMA',
        integrations: { greenInvoiceId: 'gi-1', hiveId: 'hive-org-1' },
      },
    ]);
    expect(result.content[0]?.text).toContain('Green Invoice customer gi-1');
  });

  it('reports a null Green Invoice id when the read-back has none', async () => {
    const { client } = fresh({ integrations: { greenInvoiceInfo: null } });
    const result = await runTool(createClientTool, minimal, client);

    const structured = result.structuredContent as {
      greenInvoiceId: string | null;
      clients: Array<{ integrations: Record<string, string> }>;
    };
    expect(structured.greenInvoiceId).toBeNull();
    expect(structured.clients[0].integrations).toEqual({});
  });

  it('maps an upstream CommonError to a non-retryable upstream error, without reading back', async () => {
    const { client, captured } = mutationClient({
      businesses: [notAClient],
      insertClient: { __typename: 'CommonError', message: 'Failed to create Client' },
    });
    const result = await runTool(createClientTool, minimal, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
    expect(callsTo(captured, 'client')).toHaveLength(0);
  });
});
