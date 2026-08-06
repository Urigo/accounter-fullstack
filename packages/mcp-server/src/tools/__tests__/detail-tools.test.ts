import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { getChargesTool, MAX_CHARGE_IDS, MAX_FILTERED_CHARGES } from '../charge-details.js';
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

function clientGraphQLErrors(messages: string[], capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return {
      ok: true,
      status: 200,
      json: async () => ({ errors: messages.map(message => ({ message })) }),
    } as unknown as Response;
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
  const filteredChargeFixture = {
    allCharges: {
      nodes: chargeFixture.chargesByIDs,
      pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 0, pageSize: 100 },
    },
  };

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
      includeTransactions: true,
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

  // Nesting transactions/documents by default is what forced nearly every call
  // to spill over the payload budget, so both are opt-in.
  it('omits nested transactions and documents unless asked', async () => {
    let sentBody: unknown;
    const client = clientReturning(chargeFixture, body => (sentBody = body));
    await run(getChargesTool, client, authContext([B1]), { chargeIds: ['c1'] });
    const variables = (
      sentBody as { variables: { includeTransactions: boolean; includeDocuments: boolean } }
    ).variables;
    expect(variables.includeTransactions).toBe(false);
    expect(variables.includeDocuments).toBe(false);
  });

  it('forwards all available filters to allCharges', async () => {
    let sentBody: unknown;
    const client = clientReturning(filteredChargeFixture, body => (sentBody = body));
    const result = await run(getChargesTool, client, authContext([B1]), {
      filters: {
        accountantStatus: ['APPROVED', 'PENDING'],
        byBusinessTrips: ['bt1', 'bt2'],
        byBusinesses: ['biz1'],
        byChargeTypes: ['COMMON', 'BUSINESS_TRIP'],
        byOwners: [B1, B2],
        byTags: ['office', 'vat'],
        chargesType: 'EXPENSE',
        freeText: 'coffee',
        fromAnyDate: '2026-01-01',
        fromDate: '2026-01-01',
        sortBy: { field: 'DATE', asc: false },
        toAnyDate: '2026-01-31',
        toDate: '2026-01-31',
        withMissingCounterparty: false,
        withOpenDocuments: true,
        withoutDocuments: false,
        withoutInvoice: false,
        withoutLedger: false,
        withoutReceipt: false,
        withoutTransactions: false,
      },
      includeTransactions: false,
      includeDocuments: true,
    });

    expect(result.isError).toBeUndefined();
    const variables = (
      sentBody as {
        variables: {
          filters: Record<string, unknown>;
          includeTransactions: boolean;
          includeDocuments: boolean;
          page: number;
          limit: number;
        };
      }
    ).variables;

    expect(variables.filters).toEqual({
      accountantStatus: ['APPROVED', 'PENDING'],
      byBusinessTrips: ['bt1', 'bt2'],
      byBusinesses: ['biz1'],
      byChargeTypes: ['COMMON', 'BUSINESS_TRIP'],
      byOwners: [B1],
      byTags: ['office', 'vat'],
      chargesType: 'EXPENSE',
      freeText: 'coffee',
      fromAnyDate: '2026-01-01',
      fromDate: '2026-01-01',
      sortBy: { field: 'DATE', asc: false },
      toAnyDate: '2026-01-31',
      toDate: '2026-01-31',
      withMissingCounterparty: false,
      withOpenDocuments: true,
      withoutDocuments: false,
      withoutInvoice: false,
      withoutLedger: false,
      withoutReceipt: false,
      withoutTransactions: false,
    });
    expect(variables.includeTransactions).toBe(false);
    expect(variables.includeDocuments).toBe(true);
    expect(variables.page).toBe(0);
    expect(variables.limit).toBe(MAX_FILTERED_CHARGES);
  });

  // The filtered path used to be pinned to upstream page 0, so a filter matching
  // more than MAX_FILTERED_CHARGES charges had no way to reach the rest.
  it('forwards the requested page and pageSize to allCharges', async () => {
    let sentBody: unknown;
    const client = clientReturning(
      {
        allCharges: {
          nodes: chargeFixture.chargesByIDs,
          pageInfo: { totalPages: 3, totalRecords: 25 },
        },
      },
      body => (sentBody = body),
    );
    const result = await run(getChargesTool, client, authContext([B1]), {
      filters: { freeText: 'coffee' },
      page: 2,
      pageSize: 10,
    });

    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { page: number; limit: number } }).variables;
    // Upstream slices `[page * limit, …]`, so the 1-based input page is shifted.
    expect(variables.page).toBe(1);
    expect(variables.limit).toBe(10);

    const structured = result.structuredContent as {
      totalCount: number;
      pagination: { page: number; pageSize: number; totalPages: number; hasNextPage: boolean };
    };
    expect(structured.totalCount).toBe(25);
    expect(structured.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  // A by-id fetch returns exactly the ids asked for, so a page number over it
  // would be meaningless — and would invite the model to "fetch the next page".
  it('omits pagination when fetching by id', async () => {
    const client = clientReturning(chargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds: ['c1'] });
    expect(result.structuredContent).not.toHaveProperty('pagination');
  });

  it('rejects ChargeFilter fields upstream accepts but ignores', async () => {
    const client = clientReturning(filteredChargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), {
      filters: { unbalanced: true },
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('combines chargeIds with filters and keeps only requested ids', async () => {
    const client = clientReturning({
      allCharges: {
        nodes: [
          ...chargeFixture.chargesByIDs,
          {
            ...chargeFixture.chargesByIDs[0],
            id: 'c2',
          },
        ],
        pageInfo: { totalPages: 1, totalRecords: 2, currentPage: 0, pageSize: 100 },
      },
    });

    const result = await run(getChargesTool, client, authContext([B1]), {
      chargeIds: ['c1'],
      filters: { freeText: 'coffee' },
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as { charges: Array<{ id: string }> };
    expect(structured.charges).toHaveLength(1);
    expect(structured.charges[0]?.id).toBe('c1');
  });

  it('classifies a charge from its typename', async () => {
    const client = clientReturning({
      chargesByIDs: [
        { ...chargeFixture.chargesByIDs[0], __typename: 'CreditcardBankCharge' },
        {
          ...chargeFixture.chargesByIDs[0],
          id: 'c2',
          __typename: 'CommonCharge',
          totalAmount: { raw: 5000, formatted: '₪5,000.00', currency: 'ILS' },
        },
      ],
    });
    const result = await run(getChargesTool, client, authContext([B1]), {
      chargeIds: ['c1', 'c2'],
    });
    const { charges } = result.structuredContent as {
      charges: Array<{ chargeType: string | null }>;
    };
    // A card settlement moves money between the owner's own accounts.
    expect(charges[0]).toMatchObject({
      chargeType: 'CREDITCARD_BANK',
    });
    expect(charges[1]).toMatchObject({ chargeType: 'COMMON' });
  });

  it('drops a charge whose owner is outside the resolved scope (defense-in-depth)', async () => {
    const client = clientReturning(chargeFixture);
    // Caller is authorized for B2 only; the fixture charge is owned by B1.
    const result = await run(getChargesTool, client, authContext([B2]), { chargeIds: ['c1'] });
    const structured = result.structuredContent as { charges: unknown[] };
    expect(structured.charges).toEqual([]);
    expect(result.content[0]!.text).toMatch(/No charges/);
  });

  it('normalizes upstream chargesByIDs not-found error to empty result', async () => {
    const client = clientGraphQLErrors(['Charge ID="missing" not found']);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds: ['missing'] });
    expect(result.isError).toBeUndefined();
    expect((result.structuredContent as { charges: unknown[] }).charges).toEqual([]);
    expect(result.content[0]!.text).toMatch(/No charges/);
  });

  it('rejects an empty id list', async () => {
    const client = clientReturning(chargeFixture);
    const result = await run(getChargesTool, client, authContext([B1]), { chargeIds: [] });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('treats empty chargeIds as undefined when filters are provided', async () => {
    let sentBody: unknown;
    const client = clientReturning(filteredChargeFixture, body => (sentBody = body));
    const result = await run(getChargesTool, client, authContext([B1]), {
      chargeIds: [],
      filters: { byTags: ['office'] },
    });

    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect('byIds' in variables).toBe(false);
    expect(variables.byTags).toEqual(['office']);
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

  it('normalizes upstream transactionsByIDs not-found error to empty result', async () => {
    const client = clientGraphQLErrors(['Transaction ID="missing" not found']);
    const result = await run(getTransactionsTool, client, authContext([B1]), {
      transactionIds: ['missing'],
    });
    expect(result.isError).toBeUndefined();
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

  it('forwards all filters to transactionsByFilters and normalizes the result', async () => {
    let sentBody: unknown;
    const client = clientReturning(
      {
        transactionsByFilters: [
          {
            __typename: 'CommonTransaction',
            id: 'tx2',
            chargeId: 'c2',
            eventDate: '2026-02-01',
            effectiveDate: '2026-02-02',
            direction: 'CREDIT',
            amount: { raw: 50, formatted: '₪50.00', currency: 'ILS' },
            sourceDescription: 'Bank transfer',
            isFee: false,
            counterparty: { id: 'cp2', name: 'Client Ltd' },
            account: { id: 'acc2', name: 'Main bank' },
          },
        ],
      },
      body => (sentBody = body),
    );

    const result = await run(getTransactionsTool, client, authContext([B1]), {
      filters: {
        byIds: ['tx2'],
        byChargeIds: ['c2'],
        byOwners: [B1, B2],
        fromEventDate: '2026-02-01',
        toEventDate: '2026-02-10',
        fromDebitDate: '2026-02-01',
        toDebitDate: '2026-02-10',
        fromAnyDate: '2026-02-01',
        toAnyDate: '2026-02-10',
        byCounterparties: ['cp2'],
        withMissingCounterparty: false,
        withMissingInfo: false,
        freeText: 'Bank',
      },
    });

    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect(variables).toEqual({
      byIds: ['tx2'],
      byChargeIds: ['c2'],
      byOwners: [B1],
      fromEventDate: '2026-02-01',
      toEventDate: '2026-02-10',
      fromDebitDate: '2026-02-01',
      toDebitDate: '2026-02-10',
      fromAnyDate: '2026-02-01',
      toAnyDate: '2026-02-10',
      byCounterparties: ['cp2'],
      withMissingCounterparty: false,
      withMissingInfo: false,
      freeText: 'Bank',
    });

    const structured = result.structuredContent as {
      transactions: Array<{ id: string; chargeId: string; direction: string }>;
    };
    expect(structured.transactions[0]).toMatchObject({
      id: 'tx2',
      chargeId: 'c2',
      direction: 'CREDIT',
    });
  });

  it('combines transactionIds with filters (no dropped filters)', async () => {
    let sentBody: unknown;
    const client = clientReturning({ transactionsByFilters: fixture.transactionsByIDs }, body => (sentBody = body));
    const result = await run(getTransactionsTool, client, authContext([B1]), {
      transactionIds: ['tx1'],
      filters: { byOwners: [B1], withMissingInfo: false },
    });
    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect(variables).toMatchObject({
      byIds: ['tx1'],
      byOwners: [B1],
      withMissingInfo: false,
    });
  });

  it('rejects when neither transactionIds nor filters is provided', async () => {
    const client = clientReturning(fixture);
    const result = await run(getTransactionsTool, client, authContext([B1]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('treats empty transactionIds as undefined (backend-compatible)', async () => {
    let sentBody: unknown;
    const client = clientReturning({ transactionsByFilters: fixture.transactionsByIDs }, body => (sentBody = body));
    const result = await run(getTransactionsTool, client, authContext([B1]), {
      transactionIds: [],
      filters: { byOwners: [B1] },
    });
    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect('byIds' in variables).toBe(false);
    expect(variables.byOwners).toEqual([B1]);
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

  it('forwards all filters to documentsByFilters and normalizes the result', async () => {
    let sentBody: unknown;
    const client = clientReturning({ documentsByFilters: [doc()] }, body => (sentBody = body));

    const result = await run(getDocumentsTool, client, authContext([B1]), {
      filters: {
        businessIds: ['biz-1'],
        ownerIds: [B1, B2],
        chargeIds: ['c1'],
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        unmatched: false,
        type: ['INVOICE', 'RECEIPT'],
        missingCounterparty: false,
        missingInfo: false,
        freeText: 'beans',
      },
    });

    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect(variables).toEqual({
      businessIDs: ['biz-1'],
      ownerIDs: [B1],
      chargeIDs: ['c1'],
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      unmatched: false,
      type: ['INVOICE', 'RECEIPT'],
      missingCounterparty: false,
      missingInfo: false,
      freeText: 'beans',
    });

    const structured = result.structuredContent as { documents: Array<{ id: string; chargeId: string }> };
    expect(structured.documents[0]).toMatchObject({ id: 'd1', chargeId: 'c1' });
  });

  it('combines documentIds with filters (no dropped filters)', async () => {
    let sentBody: unknown;
    const client = clientReturning({ documentsByFilters: [doc()] }, body => (sentBody = body));
    const result = await run(getDocumentsTool, client, authContext([B1]), {
      documentIds: ['d1'],
      filters: { type: ['INVOICE'], missingInfo: false },
    });
    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect(variables).toMatchObject({
      ownerIDs: [B1],
      type: ['INVOICE'],
      missingInfo: false,
    });
    const structured = result.structuredContent as { documents: Array<{ id: string }> };
    expect(structured.documents).toHaveLength(1);
    expect(structured.documents[0]?.id).toBe('d1');
  });

  it('rejects when neither documentIds nor filters is provided', async () => {
    const client = clientReturning({ documentsByIds: [doc()] });
    const result = await run(getDocumentsTool, client, authContext([B1]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('treats empty documentIds as undefined (backend-compatible)', async () => {
    let sentBody: unknown;
    const client = clientReturning({ documentsByFilters: [doc()] }, body => (sentBody = body));
    const result = await run(getDocumentsTool, client, authContext([B1]), {
      documentIds: [],
      filters: { ownerIds: [B1] },
    });
    expect(result.isError).toBeUndefined();
    const variables = (sentBody as { variables: { filters: Record<string, unknown> } }).variables
      .filters;
    expect(variables.ownerIDs).toEqual([B1]);
    const structured = result.structuredContent as { documents: Array<{ id: string }> };
    expect(structured.documents).toHaveLength(1);
  });
});
