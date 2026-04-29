import { describe, expect, it, vi } from 'vitest';
import { PayloadValidationError } from '../../validate-payload.js';
import { scrapeIsracard } from '../isracard.js';

const CREDS = { id: 'src-1', ownerId: '123456789', password: 'pass', last6Digits: '123456' };

const VALID_PAYLOAD = {
  Header: { Status: '1', Message: null },
  CardsTransactionsListBean: {
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

describe('scrapeIsracard — happy path', () => {
  it('resolves with an array of validated IsracardPayloads', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: VALID_PAYLOAD, isValid: true }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]!.Header.Status).toBe('1');
  });

  it('fetches one month per month in the date range', async () => {
    const getMonthTransactions = vi
      .fn()
      .mockResolvedValue({ data: VALID_PAYLOAD, isValid: true });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const threeMonthsFrom = new Date('2024-01-01');
    const threeMonthsTo = new Date('2024-03-31');
    await scrapeIsracard(CREDS, threeMonthsFrom, threeMonthsTo, noop);

    expect(getMonthTransactions).toHaveBeenCalledTimes(3);
  });

  it('skips months where data is null', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: null, isValid: null }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop);
    expect(result).toEqual([]);
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({ data: VALID_PAYLOAD, isValid: true }),
      }),
      close,
    });

    await scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeIsracard — Header.Status check', () => {
  it('throws when Header.Status is not "1"', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { ...VALID_PAYLOAD, Header: { Status: '2', Message: 'Replace password' } },
          isValid: true,
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow(
      'login/password issue',
    );
  });
});

describe('scrapeIsracard — invalid payload', () => {
  it('throws PayloadValidationError when data fails schema validation', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { Header: { Status: '1', Message: null }, unexpected: 'shape' },
          isValid: true,
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toBeInstanceOf(
      PayloadValidationError,
    );
  });

  it('calls close() even on validation error', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      isracard: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          data: { Header: { Status: '1', Message: null }, unexpected: 'shape' },
          isValid: true,
        }),
      }),
      close,
    });

    await expect(scrapeIsracard(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
