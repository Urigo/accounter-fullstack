import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerLockError } from '../../../../shared/errors.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import type { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { IInsertLedgerRecordsParams } from '../../types.js';
import { LedgerProvider } from '../ledger.provider.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_OWNER_ID = '00000000-0000-0000-0000-000000000002';

type LedgerRecordInput = IInsertLedgerRecordsParams['ledgerRecords'][number];

function makeRecord(overrides: Partial<LedgerRecordInput> = {}): LedgerRecordInput {
  return {
    chargeId: '00000000-0000-0000-0000-0000000000c1',
    creditEntity1: '00000000-0000-0000-0000-0000000000e1',
    creditEntity2: null,
    creditForeignAmount1: null,
    creditForeignAmount2: null,
    creditLocalAmount1: 100,
    creditLocalAmount2: null,
    currency: 'ILS',
    debitEntity1: '00000000-0000-0000-0000-0000000000e2',
    debitEntity2: null,
    debitForeignAmount1: null,
    debitForeignAmount2: null,
    debitLocalAmount1: 100,
    debitLocalAmount2: null,
    description: 'test',
    invoiceDate: '2026-01-15' as TimelessDateString,
    ownerId: OWNER_ID,
    reference: null,
    valueDate: '2026-01-15' as TimelessDateString,
    ...overrides,
  };
}

describe('LedgerProvider — ledger lock', () => {
  let query: ReturnType<typeof vi.fn>;
  let provider: LedgerProvider;
  let ledgerLocks: Record<string, string | undefined>;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    ledgerLocks = { [OWNER_ID]: '2025-12-31', [OTHER_OWNER_ID]: undefined };
    const adminContextProvider = {
      getVerifiedAdminContext: vi.fn(async () => ({
        ownerId: OWNER_ID,
        defaultLocalCurrency: 'ILS',
        ledgerLock: ledgerLocks[OWNER_ID],
      })),
      adminContextByOwnerIdLoader: {
        load: vi.fn(async (ownerId: string) => ({ ownerId, ledgerLock: ledgerLocks[ownerId] })),
      },
    } as unknown as AdminContextProvider;
    provider = new LedgerProvider({ query } as unknown as TenantAwareDBClient, adminContextProvider);
  });

  it('rejects inserting a record with an invoice date on the lock date', async () => {
    await expect(
      provider.insertLedgerRecords({
        ledgerRecords: [makeRecord({ invoiceDate: '2025-12-31' as TimelessDateString })],
      }),
    ).rejects.toBeInstanceOf(LedgerLockError);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects inserting a record with a value date before the lock date', async () => {
    await expect(
      provider.insertLedgerRecords({
        ledgerRecords: [makeRecord(), makeRecord({ valueDate: '2025-06-01' as TimelessDateString })],
      }),
    ).rejects.toBeInstanceOf(LedgerLockError);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows inserting records dated after the lock date', async () => {
    await provider.insertLedgerRecords({ ledgerRecords: [makeRecord()] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("uses the record owner's lock date, not the request's", async () => {
    await provider.insertLedgerRecords({
      ledgerRecords: [
        makeRecord({ ownerId: OTHER_OWNER_ID, invoiceDate: '2025-06-01' as TimelessDateString }),
      ],
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('allows the insert once the lock is moved back (reopened)', async () => {
    const record = makeRecord({ invoiceDate: '2025-12-31' as TimelessDateString });
    await expect(provider.insertLedgerRecords({ ledgerRecords: [record] })).rejects.toBeInstanceOf(
      LedgerLockError,
    );
    ledgerLocks[OWNER_ID] = '2025-11-30';
    await provider.insertLedgerRecords({ ledgerRecords: [record] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  describe('updateLedgerRecord', () => {
    const LEDGER_ID = '00000000-0000-0000-0000-0000000000r1';
    let storedRecord: { invoice_date: string; value_date: string };

    beforeEach(() => {
      storedRecord = { invoice_date: '2026-01-15', value_date: '2026-01-15' };
      query.mockImplementation(async (text: string) => {
        if (text.includes('WHERE id IN')) {
          return { rows: [{ id: LEDGER_ID, owner_id: OWNER_ID, ...storedRecord }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });
    });

    const updateCalls = () =>
      query.mock.calls.filter(([text]) => String(text).includes('UPDATE accounter_schema.ledger_records'));

    it('rejects updating a record that is in the locked period', async () => {
      storedRecord.value_date = '2025-12-31';
      await expect(
        provider.updateLedgerRecord({ ledgerId: LEDGER_ID, description: 'x' }),
      ).rejects.toBeInstanceOf(LedgerLockError);
      expect(updateCalls()).toHaveLength(0);
    });

    it('rejects moving an unlocked record into the locked period', async () => {
      await expect(
        provider.updateLedgerRecord({
          ledgerId: LEDGER_ID,
          invoiceDate: '2025-12-15' as TimelessDateString,
        }),
      ).rejects.toBeInstanceOf(LedgerLockError);
      expect(updateCalls()).toHaveLength(0);
    });

    it('allows updating an unlocked record within the open period', async () => {
      await provider.updateLedgerRecord({
        ledgerId: LEDGER_ID,
        invoiceDate: '2026-02-01' as TimelessDateString,
      });
      expect(updateCalls()).toHaveLength(1);
    });
  });
});
