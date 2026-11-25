import { describe, expect, it, vi } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { LedgerRecordsLockProvider } from '../ledger-records-lock.provider.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const DATE = '2025-12-31' as TimelessDateString;

describe('LedgerRecordsLockProvider.lockRecordsUpTo', () => {
  it("flags only the owner's unflagged records dated on or before the date", async () => {
    const dbQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const provider = new LedgerRecordsLockProvider({ query: dbQuery } as unknown as TenantAwareDBClient);

    await provider.lockRecordsUpTo({ ownerId: OWNER_ID, date: DATE });

    expect(dbQuery).toHaveBeenCalledTimes(1);
    const [text, values] = dbQuery.mock.calls[0];
    expect(text).toMatch(/SET locked = TRUE/);
    expect(text).toMatch(/owner_id = \$\d/);
    expect(text).toMatch(/locked IS NOT TRUE/);
    expect(values).toEqual(expect.arrayContaining([OWNER_ID, DATE]));
  });

  it('runs on the given executor (the caller transaction) instead of the request client', async () => {
    const dbQuery = vi.fn();
    const executorQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const provider = new LedgerRecordsLockProvider({ query: dbQuery } as unknown as TenantAwareDBClient);

    await provider.lockRecordsUpTo({ ownerId: OWNER_ID, date: DATE }, { query: executorQuery });

    expect(executorQuery).toHaveBeenCalledTimes(1);
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
