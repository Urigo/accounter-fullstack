import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../../../shared/types/auth.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import { AdminContextProvider } from '../providers/admin-context.provider.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-0000000000aa';
const d = (date: string) => date as TimelessDateString;

describe('AdminContextProvider.moveLedgerLock', () => {
  let storedLock: string | null;
  let clientQuery: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let auditLog: ReturnType<typeof vi.fn>;
  let provider: AdminContextProvider;

  beforeEach(() => {
    storedLock = '2025-12-31';
    clientQuery = vi.fn(async (text: string, values: unknown[]) => {
      if (text.includes('FOR UPDATE')) {
        return { rows: [{ ledger_lock: storedLock }], rowCount: 1 };
      }
      if (text.includes('SET ledger_lock')) {
        storedLock = values.find(v => typeof v === 'string' && /^\d{4}-/.test(v)) as string;
        return { rows: [{ ledger_lock: storedLock }], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${text}`);
    });
    const client = { query: clientQuery };
    transaction = vi.fn(async (fn: (c: typeof client) => Promise<unknown>) => fn(client));
    auditLog = vi.fn().mockResolvedValue(undefined);

    const authContextProvider = {
      getAuthContext: vi.fn().mockResolvedValue({
        authType: 'jwt',
        tenant: { businessId: OWNER_ID },
      } as AuthContext),
    } as unknown as AuthContextProvider;

    provider = new AdminContextProvider(
      authContextProvider,
      { query: vi.fn(), transaction } as unknown as TenantAwareDBClient,
      { log: auditLog } as unknown as AuditLogsProvider,
    );
  });

  it('moves the lock forward and logs it in the same transaction', async () => {
    const moved = await provider.moveLedgerLock({
      action: 'LOCK',
      date: d('2026-12-31'),
      userId: USER_ID,
    });

    expect(moved).toBe(true);
    expect(storedLock).toBe('2026-12-31');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        userId: USER_ID,
        action: 'LEDGER_LOCKED',
        details: { from: '2025-12-31', to: '2026-12-31' },
      }),
      // the audit entry is written on the transaction's client
      expect.objectContaining({ query: clientQuery }),
    );
  });

  it('locks a never-locked ledger', async () => {
    storedLock = null;
    await provider.moveLedgerLock({ action: 'LOCK', date: d('2025-12-31') });
    expect(storedLock).toBe('2025-12-31');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ details: { from: null, to: '2025-12-31' } }),
      expect.anything(),
    );
  });

  it('refuses to move the lock backward', async () => {
    await expect(
      provider.moveLedgerLock({ action: 'LOCK', date: d('2025-06-30') }),
    ).rejects.toThrow(/already locked until 2025-12-31/);
    expect(storedLock).toBe('2025-12-31');
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('skips the write and the audit entry when locking to the current date', async () => {
    const moved = await provider.moveLedgerLock({ action: 'LOCK', date: d('2025-12-31') });
    expect(moved).toBe(false);
    expect(clientQuery).toHaveBeenCalledTimes(1); // only the FOR UPDATE read
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('reopens to an earlier date and logs the reason', async () => {
    const moved = await provider.moveLedgerLock({
      action: 'UNLOCK',
      date: d('2025-11-30'),
      reason: '  auditor adjustments ',
      userId: USER_ID,
    });

    expect(moved).toBe(true);
    expect(storedLock).toBe('2025-11-30');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LEDGER_UNLOCKED',
        details: { from: '2025-12-31', to: '2025-11-30', reason: 'auditor adjustments' },
      }),
      expect.anything(),
    );
  });

  it('requires a reason to reopen', async () => {
    await expect(
      provider.moveLedgerLock({ action: 'UNLOCK', date: d('2025-11-30'), reason: '   ' }),
    ).rejects.toThrow(/reason is required/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires the reopen date to be before the current lock', async () => {
    for (const date of ['2025-12-31', '2026-01-31']) {
      await expect(
        provider.moveLedgerLock({ action: 'UNLOCK', date: d(date), reason: 'x' }),
      ).rejects.toThrow(/must be before the current lock date/);
    }
    expect(storedLock).toBe('2025-12-31');
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('refuses to reopen a ledger that is not locked', async () => {
    storedLock = null;
    await expect(
      provider.moveLedgerLock({ action: 'UNLOCK', date: d('2025-11-30'), reason: 'x' }),
    ).rejects.toThrow(/not locked/);
  });

  it('does not log when the lock update fails', async () => {
    clientQuery.mockImplementation(async (text: string) => {
      if (text.includes('FOR UPDATE')) {
        return { rows: [{ ledger_lock: storedLock }], rowCount: 1 };
      }
      throw new Error('connection lost');
    });
    await expect(
      provider.moveLedgerLock({ action: 'LOCK', date: d('2026-12-31') }),
    ).rejects.toThrow('connection lost');
    expect(auditLog).not.toHaveBeenCalled();
  });
});
