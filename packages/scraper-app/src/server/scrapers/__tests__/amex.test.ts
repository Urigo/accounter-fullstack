import { describe, expect, it, vi } from 'vitest';
import { scrapeAmex } from '../amex.js';

const CREDS = { id: 'src-1', ownerId: '123456789', password: 'pass', last6Digits: '123456' };

const VALID_PAYLOAD = {
  Header: { Status: '1', Message: null },
  CardsTransactionsListBean: {
    cardNumberList: ['010101'],
    Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
  },
};

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

describe('scrapeAmex — happy path', () => {
  it('resolves with an array of MonthlyIsracardPayloads', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: VALID_PAYLOAD, isValid: true }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeAmex(CREDS, DATE_FROM, DATE_TO, noop);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]!.month).toBe('2024-01');
    expect(result[0]!.data.Header.Status).toBe('1');
  });

  it('fetches one month per month in the date range', async () => {
    const getMonthTransactions = vi
      .fn()
      .mockResolvedValue({ data: VALID_PAYLOAD, isValid: true });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const threeMonthsFrom = new Date('2024-01-01');
    const threeMonthsTo = new Date('2024-03-31');
    await scrapeAmex(CREDS, threeMonthsFrom, threeMonthsTo, noop);

    expect(getMonthTransactions).toHaveBeenCalledTimes(3);
  });

  it('skips months where data is null and throws if all months fail', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: null, isValid: null }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeAmex(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow(
      'All months failed to scrape',
    );
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: VALID_PAYLOAD, isValid: true }),
      }),
      close,
    });

    await scrapeAmex(CREDS, DATE_FROM, DATE_TO, noop);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeAmex — Header.Status check', () => {
  it('emits task-month-error and throws "All months failed" when Header.Status is not "1"', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { ...VALID_PAYLOAD, Header: { Status: '2', Message: 'Replace password' } },
          isValid: true,
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const emitted: string[] = [];
    await expect(
      scrapeAmex(CREDS, DATE_FROM, DATE_TO, msg => emitted.push(msg.type)),
    ).rejects.toThrow('All months failed to scrape');
    expect(emitted).toContain('task-month-error');
  });
});

describe('scrapeAmex — invalid payload', () => {
  it('emits task-month-error and throws when data fails schema validation', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { Header: { Status: '1', Message: null }, unexpected: 'shape' },
          isValid: true,
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const emitted: string[] = [];
    await expect(
      scrapeAmex(CREDS, DATE_FROM, DATE_TO, msg => emitted.push(msg.type)),
    ).rejects.toThrow();
    expect(emitted).toContain('task-month-error');
  });

  it('calls close() even on validation error', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      amex: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { Header: { Status: '1', Message: null }, unexpected: 'shape' },
          isValid: true,
        }),
      }),
      close,
    });

    await expect(scrapeAmex(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
