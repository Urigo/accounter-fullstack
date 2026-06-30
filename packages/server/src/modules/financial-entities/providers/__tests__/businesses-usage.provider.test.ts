import { describe, expect, it, vi } from 'vitest';
import { BusinessUsageProvider } from '../businesses-usage.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';

type Row = { business_id: string | null; source: string | null; count: string | null };

function createProvider(rows: Row[]) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  const db = { query } as unknown as TenantAwareDBClient;
  return { provider: new BusinessUsageProvider(db), query };
}

describe('BusinessUsageProvider', () => {
  it('returns an empty map when no ids are requested', async () => {
    const { provider, query } = createProvider([]);
    const result = await provider.getUsageByBusinessIds([]);
    expect(result.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('runs a single combined query and merges per-source rows by business id', async () => {
    const { provider, query } = createProvider([
      { business_id: 'b1', source: 'transactions', count: '3' },
      { business_id: 'b1', source: 'documents', count: '2' },
      { business_id: 'b1', source: 'misc_expenses', count: '1' },
      { business_id: 'b1', source: 'ledger', count: '5' },
    ]);

    const result = await provider.getUsageByBusinessIds(['b1']);

    expect(query).toHaveBeenCalledTimes(1);
    expect(result.get('b1')).toEqual({
      transactions: 3,
      documents: 2,
      miscExpenses: 1,
      ledgerRecords: 5,
    });
  });

  it('defaults every requested business to zero counts', async () => {
    const { provider } = createProvider([
      { business_id: 'b1', source: 'transactions', count: '4' },
    ]);

    const result = await provider.getUsageByBusinessIds(['b1', 'b2']);

    expect(result.get('b1')).toEqual({
      transactions: 4,
      documents: 0,
      miscExpenses: 0,
      ledgerRecords: 0,
    });
    expect(result.get('b2')).toEqual({
      transactions: 0,
      documents: 0,
      miscExpenses: 0,
      ledgerRecords: 0,
    });
  });
});
