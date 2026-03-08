import { describe, expect, it, vi } from 'vitest';
import { BusinessesProvider } from '../businesses.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';

type BusinessRow = {
  id: string;
  name: string;
  owner_id: string;
};

function createProvider(rows: BusinessRow[]) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  const db = {
    query,
  } as unknown as TenantAwareDBClient;

  const adminContextProvider = {
    getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: 'owner-a' }),
  } as unknown as AdminContextProvider;

  return {
    provider: new BusinessesProvider(db, adminContextProvider),
    db,
    query,
  };
}

describe('BusinessesProvider (RLS path)', () => {
  it('isolates data by tenant context through TenantAwareDBClient instance', async () => {
    const tenantARows: BusinessRow[] = [
      { id: 'business-a', name: 'Business A', owner_id: 'owner-a' },
    ];
    const tenantBRows: BusinessRow[] = [
      { id: 'business-b', name: 'Business B', owner_id: 'owner-b' },
    ];

    const { provider: providerA } = createProvider(tenantARows);
    const { provider: providerB } = createProvider(tenantBRows);

    const resultA = await providerA.getAllBusinesses();
    const resultB = await providerB.getAllBusinesses();

    expect(resultA).toContainEqual(expect.objectContaining({ name: 'Business A' }));
    expect(resultA).not.toContainEqual(expect.objectContaining({ name: 'Business B' }));
    expect(resultB).toContainEqual(expect.objectContaining({ name: 'Business B' }));
    expect(resultB).not.toContainEqual(expect.objectContaining({ name: 'Business A' }));
  });

  it('queries businesses without manual businessId filter arguments', async () => {
    const { provider, query } = createProvider([
      { id: 'business-a', name: 'Business A', owner_id: 'owner-a' },
    ]);

    await provider.getAllBusinesses();

    expect(query).toHaveBeenCalledTimes(1);

    const [queryText, values] = query.mock.calls[0];
    expect(queryText).toContain('FROM accounter_schema.businesses');
    expect(queryText).not.toContain('WHERE business_id =');
    expect(values === undefined || (Array.isArray(values) && values.length === 0)).toBe(true);
  });

  it('reuses cached getAllBusinesses result within provider instance', async () => {
    const { provider, query } = createProvider([
      { id: 'business-a', name: 'Business A', owner_id: 'owner-a' },
    ]);

    const first = await provider.getAllBusinesses();
    const second = await provider.getAllBusinesses();

    expect(first).toEqual(second);
    expect(query.mock.calls.length).toBe(1);
  });
});
