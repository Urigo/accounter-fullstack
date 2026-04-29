import { describe, expect, it, vi } from 'vitest';
import { PayloadValidationError } from '../../validate-payload.js';
import { scrapeCal } from '../cal.js';

const CREDS = { id: 'src-1', username: 'user', password: 'pass', last4Digits: '1234' };

const DATE_FROM = new Date('2024-01-01');
const DATE_TO = new Date('2024-01-31');
const noop = () => {};

vi.mock('@accounter/modern-poalim-scraper', () => ({
  init: vi.fn(),
}));

async function getInitMock() {
  const mod = await import('@accounter/modern-poalim-scraper');
  return mod.init as ReturnType<typeof vi.fn>;
}

describe('scrapeCal — happy path', () => {
  it('resolves with a validated CalPayload containing one entry per month', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue([]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeCal(CREDS, DATE_FROM, DATE_TO, noop);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ card: '1234', month: '2024-01', transactions: [] });
  });

  it('fetches one month per month in the date range', async () => {
    const getMonthTransactions = vi.fn().mockResolvedValue([]);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const threeMonthsFrom = new Date('2024-01-01');
    const threeMonthsTo = new Date('2024-03-31');
    const result = await scrapeCal(CREDS, threeMonthsFrom, threeMonthsTo, noop);

    expect(getMonthTransactions).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.month)).toEqual(['2024-01', '2024-02', '2024-03']);
  });

  it('passes last4Digits and month correctly to getMonthTransactions', async () => {
    const getMonthTransactions = vi.fn().mockResolvedValue([]);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await scrapeCal(CREDS, DATE_FROM, DATE_TO, noop);

    expect(getMonthTransactions).toHaveBeenCalledWith('1234', expect.any(Date));
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({ getMonthTransactions: vi.fn().mockResolvedValue([]) }),
      close,
    });

    await scrapeCal(CREDS, DATE_FROM, DATE_TO, noop);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeCal — transactions included', () => {
  it('includes transactions returned by getMonthTransactions', async () => {
    const mockTxn = {
      trnIntId: 'txn-1',
      merchantName: 'Shop',
      trnPurchaseDate: '2024-01-15',
      trnAmt: 100,
      trnCurrencySymbol: 'ILS',
      trnType: 'normal',
      debCrdDate: '2024-02-01',
      amtBeforeConvAndIndex: 100,
      debCrdCurrencySymbol: 'ILS',
    };
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue([mockTxn]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeCal(CREDS, DATE_FROM, DATE_TO, noop);
    expect(result[0]!.transactions).toHaveLength(1);
    expect(result[0]!.transactions[0]!.merchantName).toBe('Shop');
  });
});

describe('scrapeCal — invalid payload', () => {
  it('throws PayloadValidationError when a transaction fails schema validation', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({
        // Return a transaction missing required fields
        getMonthTransactions: vi.fn().mockResolvedValue([{ trnIntId: 'x' }]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeCal(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toBeInstanceOf(
      PayloadValidationError,
    );
  });

  it('calls close() even on validation error', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      cal: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue([{ trnIntId: 'x' }]),
      }),
      close,
    });

    await expect(scrapeCal(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
