import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import type { IGetDocumentsByChargeIdResult } from '../../../documents/types.js';
import { describeError, describeErrorForUser } from '../deel-sync-errors.js';
import {
  convertMatchToDeelInvoiceRecord,
  createDeelInvoiceMatchFromUnmatchedInvoice,
  getDeelBusinessId,
  getDeelBusinessIdForLedger,
  isDeelDocument,
  requireDeelBusinessId,
} from '../deel.helper.js';
import type { Invoice } from '../../../app-providers/deel/schemas.js';

const DEEL_BUSINESS_ID = 'deel-business';

function injectorWithStatuses(statuses: unknown[]): Injector {
  return {
    get: () => ({ getProviderStatuses: vi.fn(async () => statuses) }),
  } as unknown as Injector;
}

function document(overrides: Partial<IGetDocumentsByChargeIdResult>) {
  return {
    creditor_id: DEEL_BUSINESS_ID,
    debtor_id: 'owner',
    type: 'INVOICE',
    ...overrides,
  } as IGetDocumentsByChargeIdResult;
}

describe('isDeelDocument', () => {
  it('recognises financial documents of the configured Deel business', () => {
    expect(isDeelDocument(document({}), DEEL_BUSINESS_ID)).toBe(true);
    expect(
      isDeelDocument(document({ creditor_id: 'x', debtor_id: DEEL_BUSINESS_ID }), DEEL_BUSINESS_ID),
    ).toBe(true);
  });

  it('rejects other businesses and non-financial documents', () => {
    expect(isDeelDocument(document({ creditor_id: 'someone-else' }), DEEL_BUSINESS_ID)).toBe(false);
    expect(isDeelDocument(document({ type: 'RECEIPT' }), DEEL_BUSINESS_ID)).toBe(false);
  });

  it('recognises nothing when no Deel business is configured', () => {
    expect(isDeelDocument(document({}), null)).toBe(false);
  });
});

describe('getDeelBusinessId / requireDeelBusinessId', () => {
  it("reads the business of the Deel provider's status", async () => {
    const injector = injectorWithStatuses([
      { provider: 'green_invoice', configuredAt: '', businessId: 'gi' },
      { provider: 'deel', configuredAt: '', businessId: DEEL_BUSINESS_ID },
    ]);
    await expect(getDeelBusinessId(injector)).resolves.toBe(DEEL_BUSINESS_ID);
    await expect(requireDeelBusinessId(injector)).resolves.toBe(DEEL_BUSINESS_ID);
  });

  it('explains how to set a missing Deel business', async () => {
    const injector = injectorWithStatuses([{ provider: 'deel', configuredAt: '', businessId: null }]);
    await expect(getDeelBusinessId(injector)).resolves.toBeNull();

    const error = await requireDeelBusinessId(injector).catch(e => e);
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect((error as GraphQLError).message).toContain('Provider integrations → Deel');
  });
});

describe('describeError', () => {
  it('joins the cause chain into one message', () => {
    const error = new Error('Failed to fetch Deel salary invoices', {
      cause: new Error('Deel API GET /invoices responded 503'),
    });
    expect(describeError(error)).toBe(
      'Failed to fetch Deel salary invoices: Deel API GET /invoices responded 503',
    );
  });

  it('stops at a GraphQLError, whose message is meant for the user', () => {
    const error = new GraphQLError('Deel credentials not configured for this tenant', {
      originalError: new Error('internal detail'),
    });
    expect(describeError(error)).toBe('Deel credentials not configured for this tenant');
  });

  it('handles non-errors', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(undefined)).toBe('Unknown error');
  });
});

describe('getDeelBusinessIdForLedger', () => {
  it("doesn't read the provider statuses for a charge without financial documents", async () => {
    const getProviderStatuses = vi.fn();
    const injector = { get: () => ({ getProviderStatuses }) } as unknown as Injector;

    await expect(
      getDeelBusinessIdForLedger(injector, [document({ type: 'RECEIPT' })]),
    ).resolves.toBeNull();
    expect(getProviderStatuses).not.toHaveBeenCalled();
  });

  it('treats a failed read as no Deel business, instead of failing the ledger', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const injector = {
      get: () => ({ getProviderStatuses: vi.fn().mockRejectedValue(new Error('RLS denied')) }),
    } as unknown as Injector;

    await expect(getDeelBusinessIdForLedger(injector, [document({})])).resolves.toBeNull();
  });
});

describe('describeErrorForUser', () => {
  it('summarizes a database error and points to the server logs', () => {
    const dbError = Object.assign(new Error('duplicate key value violates "deel_invoices_pkey"'), {
      code: '23505',
      severity: 'ERROR',
    });
    expect(describeErrorForUser(new Error('Error inserting Deel invoice [x]', { cause: dbError }))).toBe(
      'Error inserting Deel invoice [x]: a database error occurred (details in the server logs)',
    );
  });

  it("shows an error's public message instead of its full one", () => {
    const apiError = Object.assign(new Error('Deel API GET /payments returned … received "Jane"'), {
      publicMessage: 'Deel API GET /payments returned an unexpected payload',
    });
    expect(describeErrorForUser(new Error('Failed to fetch Deel payment receipts', { cause: apiError }))).toBe(
      'Failed to fetch Deel payment receipts: Deel API GET /payments returned an unexpected payload (details in the server logs)',
    );
  });

  it('keeps a GraphQLError message as is', () => {
    expect(describeErrorForUser(new GraphQLError('Deel credentials not configured for this tenant'))).toBe(
      'Deel credentials not configured for this tenant',
    );
  });
});

describe('convertMatchToDeelInvoiceRecord', () => {
  it('stores empty Deel dates as null', () => {
    const match = createDeelInvoiceMatchFromUnmatchedInvoice({
      id: 'i1',
      due_date: '',
      paid_at: '',
      currency: 'USD',
      amount: '1.00',
    } as Invoice);

    const record = convertMatchToDeelInvoiceRecord(match, 'doc-1');

    expect(record.dueDate).toBeNull();
    expect(record.paidAt).toBeNull();
  });
});
