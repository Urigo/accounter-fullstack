import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { getChargesTool, MAX_CHARGE_IDS } from '../charge-details.js';
import { getDocumentsTool } from '../document-details.js';
import { MAX_DETAIL_IDS } from '../entity-shapes.js';
import { executeRegisteredTool } from '../execute.js';
import type { ToolDefinition } from '../registry.js';
import { getTransactionsTool } from '../transaction-details.js';

/**
 * Unit coverage for the by-id detail tools: get_charges, get_transactions,
 * get_documents. Mirrors the harness in `charges.test.ts` — a fake upstream
 * client returns fixtures and the executor drives validation + policy + handler.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

function authContext(businessIds: string[]): McpAuthContext {
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
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown, capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function run(
  tool: ToolDefinition,
  client: UpstreamGraphQLClient,
  auth: McpAuthContext,
  rawArgs: unknown,
) {
  return executeRegisteredTool({
    tool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client,
    authorization: 'Bearer tok',
  });
}

// ---------------------------------------------------------------------------
// get_charges
// ---------------------------------------------------------------------------

const chargeFixture = {
  chargesByIDs: [
    {
      id: 'c1',
      userDescription: 'Coffee supplies',
      owner: { id: B1, name: 'Acme' },
      counterparty: { id: 'cp1', name: 'Beans Ltd' },
      totalAmount: { raw: -120, formatted: '₪-120.00', currency: 'ILS' },
      vat: { raw: -17, formatted: '₪-17.00', currency: 'ILS' },
      withholdingTax: null,
      minEventDate: '2026-01-05',
      maxEventDate: '2026-01-05',
      minDebitDate: null,
      maxDebitDate: null,
      minDocumentsDate: '2026-01-04',
      maxDocumentsDate: '2026-01-04',
      tags: [{ id: 't1', name: 'office' }],
      metadata: {
        createdAt: '2026-01-06',
        updatedAt: '2026-01-07',
        invoicesCount: 1,
        receiptsCount: 0,
        documentsCount: 1,
        transactionsCount: 1,
        ledgerCount: 2,
        miscExpensesCount: 0,
        openDocuments: false,
        invalidLedger: 'VALID',
      },
      transactions: [
        {
          __typename: 'CommonTransaction',
          id: 'tx1',
          chargeId: 'c1',
          eventDate: '2026-01-05',
          effectiveDate: '2026-01-06',
          direction: 'DEBIT',
          amount: { raw: -120, formatted: '₪-120.00', currency: 'ILS' },
          sourceDescription: 'CARD 1234',
          isFee: false,
          counterparty: { id: 'cp1', name: 'Beans Ltd' },
          account: { id: 'acc1', name: 'Main card' },
        },
      ],
      additionalDocuments: [
        {
          __typename: 'Invoice',
          id: 'd1',
          documentType: 'INVOICE',
          serialNumber: 'INV-1',
          date: '2026-01-04',
          amount: { raw: -120, formatted: '₪-120.00', currency: 'ILS' },
          vat: { raw: -17, formatted: '₪-17.00', currency: 'ILS' },
          creditor: { id: 'cp1', name: 'Beans Ltd' },
          debtor: { id: B1, name: 'Acme' },
          description: 'Monthly beans',
          file: 'https://files/d1.pdf',
          image: null,
          charge: { id: 'c1' },
        },
      ],
    },
  ],
};

describe('getChargesTool', () => {
  it('normalizes a charge with nested transactions and documents', async () => {
    const client = clientReturning(chargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds: ['c1'] });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      charges: Array<{
        id: string;
        ownerId: string;
        counterparty: { id: string; name: string };
        totalAmount: { value: number };
        tags: Array<{ id: string; name: string }>;
        transactions: Array<{ id: string; account: { name: string }; type: string }>;
        documents: Array<{ id: string; serialNumber: string; fileUrl: string; type: string }>;
      }>;
      scope: { businessIds: string[] };
    };
    const charge = structured.charges[0]!;
    expect(charge.id).toBe('c1');
    expect(charge.ownerId).toBe(B1);
    expect(charge.counterparty).toEqual({ id: 'cp1', name: 'Beans Ltd' });
    expect(charge.totalAmount).toEqual({ value: -120, formatted: '₪-120.00', currency: 'ILS' });
    expect(charge.tags).toEqual([{ id: 't1', name: 'office' }]);
    expect(charge.transactions[0]).toMatchObject({
      id: 'tx1',
      type: 'CommonTransaction',
      direction: 'DEBIT',
      account: { id: 'acc1', name: 'Main card' },
    });
    expect(charge.documents[0]).toMatchObject({
      id: 'd1',
      type: 'Invoice',
      serialNumber: 'INV-1',
      fileUrl: 'https://files/d1.pdf',
    });
    expect(structured.scope).toEqual({ businessIds: [B1] });
  });

  it('forwards include flags and charge ids to upstream', async () => {
    let sentBody: unknown;
    const client = clientReturning(chargeFixture, body => (sentBody = body));
    await run(getChargesTool, client, authContext([B1]), {
      chargeIds: ['c1', 'c2'],
      includeDocuments: false,
    });
    const variables = (
      sentBody as {
        variables: { chargeIDs: string[]; includeTransactions: boolean; includeDocuments: boolean };
      }
    ).variables;
    expect(variables.chargeIDs).toEqual(['c1', 'c2']);
    expect(variables.includeTransactions).toBe(true);
    expect(variables.includeDocuments).toBe(false);
  });

  it('drops a charge whose owner is outside the resolved scope (defense-in-depth)', async () => {
    const client = clientReturning(chargeFixture);
    // Caller is authorized for B2 only; the fixture charge is owned by B1.
    const result = await run(getChargesTool, client, authContext([B2]), { chargeIds: ['c1'] });
    const structured = result.structuredContent as { charges: unknown[] };
    expect(structured.charges).toEqual([]);
    expect(result.content[0]!.text).toMatch(/No charges/);
  });

  it('rejects an empty id list', async () => {
    const client = clientReturning(chargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds: [] });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects more than the id cap', async () => {
    const client = clientReturning(chargeFixture);
    const chargeIds = Array.from({ length: MAX_CHARGE_IDS + 1 }, (_, i) => `c${i}`);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown field', async () => {
    const client = clientReturning(chargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), {
      chargeIds: ['c1'],
      bogus: true,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// get_transactions
// ---------------------------------------------------------------------------

describe('getTransactionsTool', () => {
  const fixture = {
    transactionsByIDs: [
      {
        __typename: 'CommonTransaction',
        id: 'tx1',
        chargeId: 'c1',
        eventDate: '2026-01-05',
        effectiveDate: '2026-01-06',
        direction: 'DEBIT',
        amount: { raw: -120, formatted: '₪-120.00', currency: 'ILS' },
        sourceDescription: 'CARD 1234',
        isFee: false,
        counterparty: { id: 'cp1', name: 'Beans Ltd' },
        account: { id: 'acc1', name: 'Main card' },
      },
    ],
  };

  it('normalizes transactions and echoes scope', async () => {
    const client = clientReturning(fixture);
    const result = await run(getTransactionsTool, client, authContext([B1, B2]), {
      transactionIds: ['tx1'],
    });
    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      transactions: Array<{ id: string; chargeId: string; counterparty: { name: string } }>;
      scope: { businessIds: string[] };
    };
    expect(structured.transactions[0]).toMatchObject({
      id: 'tx1',
      chargeId: 'c1',
      direction: 'DEBIT',
      counterparty: { id: 'cp1', name: 'Beans Ltd' },
    });
    expect(structured.scope).toEqual({ businessIds: [B1, B2] });
  });

  it('forwards ids to upstream', async () => {
    let sentBody: unknown;
    const client = clientReturning(fixture, body => (sentBody = body));
    await run(getTransactionsTool, client, authContext([B1]), { transactionIds: ['tx1', 'tx2'] });
    const variables = (sentBody as { variables: { transactionIDs: string[] } }).variables;
    expect(variables.transactionIDs).toEqual(['tx1', 'tx2']);
  });

  it('reports no matches for an empty upstream result', async () => {
    const client = clientReturning({ transactionsByIDs: [] });
    const result = await run(getTransactionsTool, client, authContext([B1]), {
      transactionIds: ['missing'],
    });
    expect((result.structuredContent as { transactions: unknown[] }).transactions).toEqual([]);
    expect(result.content[0]!.text).toMatch(/No transactions/);
  });

  it('rejects more than the id cap', async () => {
    const client = clientReturning(fixture);
    const transactionIds = Array.from({ length: MAX_DETAIL_IDS + 1 }, (_, i) => `tx${i}`);
    const result = await run(getTransactionsTool, client, authContext([B1]), { transactionIds });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// get_documents
// ---------------------------------------------------------------------------

describe('getDocumentsTool', () => {
  function doc(overrides: Record<string, unknown> = {}) {
    return {
      __typename: 'Invoice',
      id: 'd1',
      documentType: 'INVOICE',
      serialNumber: 'INV-1',
      date: '2026-01-04',
      amount: { raw: -120, formatted: '₪-120.00', currency: 'ILS' },
      vat: { raw: -17, formatted: '₪-17.00', currency: 'ILS' },
      creditor: { id: 'cp1', name: 'Beans Ltd' },
      debtor: { id: B1, name: 'Acme' },
      description: 'Monthly beans',
      file: 'https://files/d1.pdf',
      image: null,
      charge: { id: 'c1', owner: { id: B1 } },
      ...overrides,
    };
  }

  it('normalizes documents and echoes scope', async () => {
    const client = clientReturning({ documentsByIds: [doc()] });
    const result = await run(getDocumentsTool, client, authContext([B1]), { documentIds: ['d1'] });
    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      documents: Array<{
        id: string;
        documentType: string;
        vat: { value: number };
        creditor: { name: string };
        chargeId: string;
        fileUrl: string;
      }>;
    };
    expect(structured.documents[0]).toMatchObject({
      id: 'd1',
      documentType: 'INVOICE',
      type: 'Invoice',
      serialNumber: 'INV-1',
      chargeId: 'c1',
      fileUrl: 'https://files/d1.pdf',
    });
    expect(structured.documents[0]!.vat).toEqual({ value: -17, formatted: '₪-17.00', currency: 'ILS' });
  });

  it('drops a document whose owning charge is outside scope', async () => {
    const client = clientReturning({
      documentsByIds: [doc({ charge: { id: 'c9', owner: { id: B2 } } })],
    });
    const result = await run(getDocumentsTool, client, authContext([B1]), { documentIds: ['d1'] });
    expect((result.structuredContent as { documents: unknown[] }).documents).toEqual([]);
    expect(result.content[0]!.text).toMatch(/No documents/);
  });

  it('keeps a document with no resolvable charge owner (RLS already scoped it)', async () => {
    const client = clientReturning({ documentsByIds: [doc({ charge: null })] });
    const result = await run(getDocumentsTool, client, authContext([B1]), { documentIds: ['d1'] });
    const structured = result.structuredContent as { documents: Array<{ id: string; chargeId: null }> };
    expect(structured.documents[0]).toMatchObject({ id: 'd1', chargeId: null });
  });

  it('forwards ids to upstream', async () => {
    let sentBody: unknown;
    const client = clientReturning({ documentsByIds: [doc()] }, body => (sentBody = body));
    await run(getDocumentsTool, client, authContext([B1]), { documentIds: ['d1', 'd2'] });
    const variables = (sentBody as { variables: { documentIds: string[] } }).variables;
    expect(variables.documentIds).toEqual(['d1', 'd2']);
  });
});
