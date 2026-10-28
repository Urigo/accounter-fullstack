import { describe, expect, it } from 'vitest';
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

const created = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'Client',
  id: BIZ,
  ownerId: B1,
  emails: ['billing@acme.example', 'ops@acme.example'],
  generatedDocumentType: 'PROFORMA',
  originalBusiness: { id: BIZ, name: 'Acme Learning Ltd.' },
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

/** The directory lookup finds a business that is not yet a client; the insert succeeds. */
const fresh = (overrides: Record<string, unknown> = {}) =>
  mutationClient({
    businesses: [{ id: BIZ, name: 'Acme Learning Ltd.', isClient: false }],
    insertClient: created(overrides),
  });

describe('createClientTool — request', () => {
  it('reads the business first, then sends only the given fields', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      {
        businessId: BIZ,
        emails: ['billing@acme.example', 'ops@acme.example'],
        generatedDocumentType: 'PROFORMA',
        integrations: { hiveId: 'hive-org-1' },
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(rootFields(captured)).toEqual(['businesses', 'insertClient']);
    const [lookup] = callsTo(captured, 'businesses');
    expect(lookup.query).toMatch(/^\s*query\b/);
    expect(lookup.variables).toEqual({ ids: [BIZ] });
    const [insert] = callsTo(captured, 'insertClient');
    expect(insert.query).toMatch(/^\s*mutation\b/);
    expect(insert.variables).toEqual({
      fields: {
        businessId: BIZ,
        generatedDocumentType: 'PROFORMA',
        emails: ['billing@acme.example', 'ops@acme.example'],
        integrations: { hiveId: 'hive-org-1' },
      },
    });
    expect(insert.headers['x-business-scope']).toBe(B1);
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

  it('does not accept a Green Invoice id — upstream assigns that itself', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA', integrations: { greenInvoiceId: 'gi-x' } },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('refuses a business that is already a client and points at accounter_list_clients', async () => {
    const { client, captured } = mutationClient({
      businesses: [{ id: BIZ, name: 'Acme Learning Ltd.', isClient: true }],
      insertClient: created(),
    });
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA' },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/already a client/);
    expect(structured.issues[0].path).toBe('businessId');
    expect(structured.issues[0].message).toContain('accounter_list_clients');
    expect(callsTo(captured, 'insertClient')).toHaveLength(0);
  });

  it('refuses an id the lookup does not return', async () => {
    const { client, captured } = mutationClient({ businesses: [], insertClient: created() });
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA' },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toContain(BIZ);
    expect(callsTo(captured, 'insertClient')).toHaveLength(0);
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = fresh();
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA' },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('createClientTool — result mapping', () => {
  it('reports the client under its business id and the Green Invoice id upstream assigned', async () => {
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
      {
        businessId: BIZ,
        emails: ['billing@acme.example', 'ops@acme.example'],
        generatedDocumentType: 'PROFORMA',
        integrations: { hiveId: 'hive-org-1' },
      },
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
        name: 'Acme Learning Ltd.',
        ownerId: B1,
        emails: ['billing@acme.example', 'ops@acme.example'],
        generatedDocumentType: 'PROFORMA',
        integrations: { greenInvoiceId: 'gi-1', hiveId: 'hive-org-1' },
      },
    ]);
    expect(result.content[0]?.text).toContain('Green Invoice customer gi-1');
  });

  it('reports a null Green Invoice id when upstream returned none', async () => {
    const { client } = fresh({ integrations: { greenInvoiceInfo: null } });
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA' },
      client,
    );

    const structured = result.structuredContent as {
      greenInvoiceId: string | null;
      clients: Array<{ integrations: Record<string, string> }>;
    };
    expect(structured.greenInvoiceId).toBeNull();
    expect(structured.clients[0].integrations).toEqual({});
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient({
      businesses: [{ id: BIZ, name: 'Acme Learning Ltd.', isClient: false }],
      insertClient: { __typename: 'CommonError', message: 'Failed to create Client' },
    });
    const result = await runTool(
      createClientTool,
      { businessId: BIZ, generatedDocumentType: 'PROFORMA' },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
  });
});
