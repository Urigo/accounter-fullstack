import { describe, expect, it, vi } from 'vitest';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { SortCodesProvider } from '../sort-codes.provider.js';

type SortCodeRow = {
  key: number;
  name: string;
  default_irs_code: number | null;
  owner_id: string;
};

function createProvider(rows: SortCodeRow[] = [], ownerId = 'owner-a') {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  const db = {
    query,
  } as unknown as TenantAwareDBClient;

  const getVerifiedAdminContext = vi.fn().mockResolvedValue({ ownerId });
  const adminContextProvider = {
    getVerifiedAdminContext,
  } as unknown as AdminContextProvider;

  return {
    provider: new SortCodesProvider(db, adminContextProvider),
    db,
    query,
    getVerifiedAdminContext,
  };
}

describe('SortCodesProvider.updateSortCode', () => {
  it('injects the context ownerId into the update query values (regression for #3787)', async () => {
    const { provider, query, getVerifiedAdminContext } = createProvider([], 'owner-a');

    await provider.updateSortCode({ key: 100, name: 'New Name', defaultIrsCode: undefined });

    expect(getVerifiedAdminContext).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);

    const [queryText, values] = query.mock.calls[0];
    expect(queryText).toContain('UPDATE accounter_schema.sort_codes');
    // The WHERE clause is scoped by both key and owner_id; the ownerId must be supplied.
    expect(values).toContain('owner-a');
  });

  it('forwards key, name and defaultIrsCode to the update query', async () => {
    const { provider, query } = createProvider([], 'owner-a');

    await provider.updateSortCode({ key: 100, name: 'New Name', defaultIrsCode: 42 });

    const [, values] = query.mock.calls[0];
    expect(values).toContain(100);
    expect(values).toContain('New Name');
    expect(values).toContain(42);
    expect(values).toContain('owner-a');
  });

  it('clears the cached sort codes after an update', async () => {
    const { provider, query } = createProvider(
      [{ key: 100, name: 'Old', default_irs_code: null, owner_id: 'owner-a' }],
      'owner-a',
    );

    await provider.getAllSortCodes();
    expect(query).toHaveBeenCalledTimes(1);

    // cache hit: no additional query
    await provider.getAllSortCodes();
    expect(query).toHaveBeenCalledTimes(1);

    await provider.updateSortCode({ key: 100, name: 'New', defaultIrsCode: undefined });

    // cache was cleared, so the next read re-queries
    await provider.getAllSortCodes();
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe('SortCodesProvider.addSortCode', () => {
  it('injects the context ownerId into the insert query values', async () => {
    const { provider, query, getVerifiedAdminContext } = createProvider([], 'owner-b');

    await provider.addSortCode({ key: 200, name: 'Cash', defaultIrsCode: undefined });

    expect(getVerifiedAdminContext).toHaveBeenCalledTimes(1);
    const [queryText, values] = query.mock.calls[0];
    expect(queryText).toContain('INSERT INTO accounter_schema.sort_codes');
    expect(values).toContain('owner-b');
    expect(values).toContain(200);
    expect(values).toContain('Cash');
  });
});
