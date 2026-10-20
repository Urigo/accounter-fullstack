import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import type { IGetDocumentsByChargeIdResult } from '../../../documents/types.js';
import { describeError } from '../deel-sync-errors.js';
import { getDeelBusinessId, isDeelDocument, requireDeelBusinessId } from '../deel.helper.js';

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
