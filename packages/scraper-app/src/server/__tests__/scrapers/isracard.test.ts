import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeIsracard } from '../../scrapers/isracard-amex.js';
import type { IsracardSourceConfig } from '../../scrapers/isracard-amex.js';
import { PayloadValidationError } from '../../validate-payload.js';

// ── Mock modern-poalim-scraper ────────────────────────────────────────────────

vi.mock('@accounter/modern-poalim-scraper');

import { init } from '@accounter/modern-poalim-scraper';

const VALID_TRANSACTIONS_DATA = {
  Header: { Status: '1', Message: null },
  CardsTransactionsListBean: {
    Index0: {
      '@AllCards': 'AllCards',
      CurrentCardTransactions: [
        {
          '@cardTransactions': 'card-1234',
          txnIsrael: [],
          txnAbroad: [],
        },
      ],
    },
  },
};

function makeScraperMock(opts: { txnData?: unknown } = {}) {
  const { txnData = VALID_TRANSACTIONS_DATA } = opts;

  const getMonthTransactions = vi.fn().mockResolvedValue({ data: txnData, isValid: null });
  const getMonthDashboard = vi.fn().mockResolvedValue({ data: null });
  const getDashboards = vi.fn().mockResolvedValue([]);
  const getTransactions = vi.fn().mockResolvedValue([]);
  const close = vi.fn().mockResolvedValue(undefined);

  const scraperObj = { getMonthTransactions, getMonthDashboard, getDashboards, getTransactions };
  const isracardFn = vi.fn().mockResolvedValue(scraperObj);
  const amexFn = vi.fn().mockResolvedValue(scraperObj);

  vi.mocked(init).mockResolvedValue({
    isracard: isracardFn,
    amex: amexFn,
    close,
  } as unknown as Awaited<ReturnType<typeof init>>);

  return { isracardFn, amexFn, getMonthTransactions, close };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CREDS: IsracardSourceConfig = {
  id: 'src-isracard-1',
  ownerId: 'owner123',
  password: 'pass1',
  last6Digits: '123456',
};

const DATE_FROM = new Date('2023-01-01');
const DATE_TO = new Date('2024-01-01');

const noop = () => {};
const noopOtpManager = { waitForOtp: vi.fn() };

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});

describe('scrapeIsracard — variant routing', () => {
  it('calls the isracard scraper fn when variant is isracard', async () => {
    const { isracardFn, amexFn } = makeScraperMock();

    await scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(isracardFn).toHaveBeenCalledOnce();
    expect(amexFn).not.toHaveBeenCalled();
  });

  it('calls the amex scraper fn when variant is amex', async () => {
    const { isracardFn, amexFn } = makeScraperMock();

    await scrapeIsracard(CREDS, 'amex', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(amexFn).toHaveBeenCalledOnce();
    expect(isracardFn).not.toHaveBeenCalled();
  });
});

describe('scrapeIsracard — credentials mapping', () => {
  it('maps ownerId→ID, last6Digits→card6Digits for isracard', async () => {
    const { isracardFn } = makeScraperMock();

    await scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(isracardFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ID: CREDS.ownerId,
        password: CREDS.password,
        card6Digits: CREDS.last6Digits,
      }),
    );
  });

  it('maps ownerId→ID, last6Digits→card6Digits for amex', async () => {
    const { amexFn } = makeScraperMock();

    await scrapeIsracard(CREDS, 'amex', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(amexFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ID: CREDS.ownerId,
        password: CREDS.password,
        card6Digits: CREDS.last6Digits,
      }),
    );
  });
});

describe('scrapeIsracard — successful scrape', () => {
  it('returns the validated payload for isracard', async () => {
    makeScraperMock();

    const result = await scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(result.Header.Status).toBe('1');
    expect(result.CardsTransactionsListBean.Index0.CurrentCardTransactions).toHaveLength(1);
  });

  it('returns the validated payload for amex', async () => {
    makeScraperMock();

    const result = await scrapeIsracard(CREDS, 'amex', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(result.Header.Status).toBe('1');
  });

  it('calls getMonthTransactions with a Date argument', async () => {
    const { getMonthTransactions } = makeScraperMock();

    await scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(getMonthTransactions).toHaveBeenCalledOnce();
    expect(getMonthTransactions).toHaveBeenCalledWith(expect.any(Date));
  });
});

describe('scrapeIsracard — cleanup', () => {
  it('closes the browser on success', async () => {
    const { close } = makeScraperMock();

    await scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop);

    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the browser even when validation fails', async () => {
    const { close } = makeScraperMock({ txnData: { completely: 'wrong' } });

    await expect(
      scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop),
    ).rejects.toThrow();

    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeIsracard — validation errors', () => {
  it('throws PayloadValidationError when data does not match schema', async () => {
    makeScraperMock({ txnData: { completely: 'wrong', shape: true } });

    await expect(
      scrapeIsracard(CREDS, 'isracard', DATE_FROM, DATE_TO, noopOtpManager, noop),
    ).rejects.toBeInstanceOf(PayloadValidationError);
  });

  it('throws PayloadValidationError for amex when data does not match schema', async () => {
    makeScraperMock({ txnData: { completely: 'wrong', shape: true } });

    await expect(
      scrapeIsracard(CREDS, 'amex', DATE_FROM, DATE_TO, noopOtpManager, noop),
    ).rejects.toBeInstanceOf(PayloadValidationError);
  });
});
