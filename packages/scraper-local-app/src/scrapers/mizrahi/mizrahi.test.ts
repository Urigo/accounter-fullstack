import { describe, expect, it, vi } from 'vitest';
import { saveTransaction } from './index.js';

function makePool(overrides: { rowCount?: number | null; throws?: boolean } = {}) {
  return {
    query: vi.fn(async () => {
      if (overrides.throws) throw new Error('DB connection error');
      const rowCount = 'rowCount' in overrides ? overrides.rowCount : 1;
      return { rowCount, rows: [] };
    }),
  };
}

describe('saveTransaction', () => {
  const baseTransaction = {
    identifier: 'TXN-001',
    date: '2024-01-15',
    processedDate: '2024-01-16',
    originalAmount: 100.5,
    originalCurrency: 'ILS',
    chargedAmount: 100.5,
    description: 'Supermarket',
    memo: null,
    status: 'completed',
    type: 'normal',
  };

  it('returns "inserted" when a new row is inserted', async () => {
    const pool = makePool({ rowCount: 1 });
    const result = await saveTransaction('123456', baseTransaction, pool as never);
    expect(result).toBe('inserted');
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it('returns "duplicate" when the transaction already exists (ON CONFLICT DO NOTHING)', async () => {
    const pool = makePool({ rowCount: 0 });
    const result = await saveTransaction('123456', baseTransaction, pool as never);
    expect(result).toBe('duplicate');
  });

  it('returns "error" and does not throw when the DB query fails', async () => {
    const pool = makePool({ throws: true });
    const result = await saveTransaction('123456', baseTransaction, pool as never);
    expect(result).toBe('error');
  });

  it('converts numeric identifier to string', async () => {
    const pool = makePool();
    await saveTransaction('123456', { ...baseTransaction, identifier: 12345 }, pool as never);
    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBe('12345');
  });

  it('passes null for missing identifier', async () => {
    const pool = makePool();
    const { identifier: _, ...noIdentifier } = baseTransaction;
    await saveTransaction('123456', noIdentifier, pool as never);
    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBeNull();
  });

  it('passes null for null memo', async () => {
    const pool = makePool();
    await saveTransaction('123456', { ...baseTransaction, memo: null }, pool as never);
    const [, params] = pool.query.mock.calls[0];
    expect(params[8]).toBeNull();
  });

  it('passes memo string through correctly', async () => {
    const pool = makePool();
    await saveTransaction(
      '123456',
      { ...baseTransaction, memo: 'Payment ref #99' },
      pool as never,
    );
    const [, params] = pool.query.mock.calls[0];
    expect(params[8]).toBe('Payment ref #99');
  });

  it('uses the account number as the first query parameter', async () => {
    const pool = makePool();
    await saveTransaction('ACCT-789', baseTransaction, pool as never);
    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe('ACCT-789');
  });

  it('handles rowCount null (some pg driver versions) as duplicate', async () => {
    const pool = makePool({ rowCount: null });
    const result = await saveTransaction('123456', baseTransaction, pool as never);
    expect(result).toBe('duplicate');
  });
});

describe('scrapeMizrahi credentials validation', () => {
  it('throws when username is empty', async () => {
    const { scrapeMizrahi } = await import('./index.js');
    await expect(
      scrapeMizrahi({ username: '', password: 'pw' }, {} as never),
    ).rejects.toThrow('Missing credentials');
  });

  it('throws when password is empty', async () => {
    const { scrapeMizrahi } = await import('./index.js');
    await expect(
      scrapeMizrahi({ username: 'user', password: '' }, {} as never),
    ).rejects.toThrow('Missing credentials');
  });
});
