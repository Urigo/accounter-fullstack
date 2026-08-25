import { describe, expect, it, vi } from 'vitest';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { ClientsProvider } from '../clients.provider.js';

/**
 * `generatedDocumentType` was accepted by both mutations and written by neither:
 * the INSERT omitted `document_type` entirely — leaning on the column's
 * 'PROFORMA' default — and the UPDATE had no clause for it. The field therefore
 * reported success while silently discarding the caller's choice, and no test
 * would have caught it, because the resolvers happily built params the SQL never
 * read. These pin the value all the way to the statement.
 */
function createProvider() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const db = { query } as unknown as TenantAwareDBClient;
  const adminContextProvider = {
    getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: 'owner-a' }),
  } as unknown as AdminContextProvider;

  return { provider: new ClientsProvider(db, adminContextProvider), query };
}

describe('ClientsProvider document_type persistence', () => {
  it('writes document_type on insert', async () => {
    const { provider, query } = createProvider();

    await provider.insertClient({
      businessId: 'business-a',
      emails: ['a@example.com'],
      integrations: {},
      generatedDocumentType: 'INVOICE',
    });

    const [queryText, values] = query.mock.calls[0];
    expect(queryText).toContain('document_type');
    expect(values).toContain('INVOICE');
  });

  it('updates document_type, leaving it untouched when not supplied', async () => {
    const { provider, query } = createProvider();

    await provider.updateClient({
      businessId: 'business-a',
      generatedDocumentType: 'RECEIPT',
    });

    const [queryText, values] = query.mock.calls[0];
    // COALESCE, not a bare assignment: an omitted field must keep the stored
    // value rather than null it out.
    expect(queryText).toContain('document_type = COALESCE');
    expect(values).toContain('RECEIPT');
  });

  it('leaves document_type null in the params when the caller omits it', async () => {
    const { provider, query } = createProvider();

    await provider.updateClient({ businessId: 'business-a', emails: ['a@example.com'] });

    const [, values] = query.mock.calls[0];
    // The COALESCE above turns this null into "keep what is stored".
    expect(values).not.toContain('RECEIPT');
  });
});
