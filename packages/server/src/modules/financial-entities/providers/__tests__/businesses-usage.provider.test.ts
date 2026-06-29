import { describe, expect, it, vi } from 'vitest';
import { BusinessUsageProvider } from '../businesses-usage.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';

type Row = { business_id: string | null; count: string | null };

function createProvider(rowsByTable: {
  transactions?: Row[];
  documents?: Row[];
  misc_expenses?: Row[];
  ledger_records?: Row[];
}) {
  const query = vi.fn().mockImplementation((text: string) => {
    let rows: Row[] = [];
    if (text.includes('accounter_schema.transactions')) {
      rows = rowsByTable.transactions ?? [];
    } else if (text.includes('accounter_schema.misc_expenses')) {
      rows = rowsByTable.misc_expenses ?? [];
    } else if (text.includes('accounter_schema.ledger_records')) {
      rows = rowsByTable.ledger_records ?? [];
    } else if (text.includes('accounter_schema.documents')) {
      rows = rowsByTable.documents ?? [];
    }
    return Promise.resolve({ rows, rowCount: rows.length });
  });
  const db = { query } as unknown as TenantAwareDBClient;
  return { provider: new BusinessUsageProvider(db), query };
}

describe('BusinessUsageProvider', () => {
  it('returns an empty map when no ids are requested', async () => {
    const { provider, query } = createProvider({});
    const result = await provider.getUsageByBusinessIds([]);
    expect(result.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('merges per-source counts into a single map keyed by business id', async () => {
    const { provider } = createProvider({
      transactions: [{ business_id: 'b1', count: '3' }],
      documents: [{ business_id: 'b1', count: '2' }],
      misc_expenses: [{ business_id: 'b1', count: '1' }],
      ledger_records: [{ business_id: 'b1', count: '5' }],
    });

    const result = await provider.getUsageByBusinessIds(['b1']);

    expect(result.get('b1')).toEqual({
      transactions: 3,
      documents: 2,
      miscExpenses: 1,
      ledgerRecords: 5,
    });
  });

  it('defaults every requested business to zero counts', async () => {
    const { provider } = createProvider({
      transactions: [{ business_id: 'b1', count: '4' }],
    });

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
