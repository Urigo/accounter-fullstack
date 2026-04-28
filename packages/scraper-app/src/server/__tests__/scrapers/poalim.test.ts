import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapePoalim } from '../../scrapers/poalim.js';
import type { OtpManager, PoalimSourceConfig } from '../../scrapers/poalim.js';
import { PayloadValidationError } from '../../validate-payload.js';

// ── Mock modern-poalim-scraper ────────────────────────────────────────────────

vi.mock('@accounter/modern-poalim-scraper');

import { init } from '@accounter/modern-poalim-scraper';

const VALID_ILS_DATA = {
  transactions: [
    {
      activityDescription: 'Credit',
      activityTypeCode: 1,
      eventAmount: 1000,
      eventDate: 20_240_101,
      serialNumber: 1,
      transactionType: 'REGULAR',
      currentBalance: 5000,
      referenceNumber: 12_345,
    },
  ],
  retrievalTransactionData: { accountNumber: 100_000, branchNumber: 600, bankNumber: 12 },
};

const ACCOUNT = { bankNumber: 12, branchNumber: 600, accountNumber: 100_000 };

function makeScraperMock(opts: {
  ilsData?: unknown;
  callOtpCallback?: boolean;
} = {}) {
  const { ilsData = VALID_ILS_DATA, callOtpCallback = false } = opts;

  const getILSTransactions = vi.fn().mockResolvedValue({ data: ilsData, isValid: true });
  const getAccountsData = vi.fn().mockResolvedValue({ data: [ACCOUNT], isValid: true });
  const close = vi.fn().mockResolvedValue(undefined);

  const hapoalim = vi.fn().mockImplementation(
    async (_creds: unknown, scraperOpts?: { otpCallback?: () => Promise<string> }) => {
      if (callOtpCallback) {
        await scraperOpts?.otpCallback?.();
      }
      return { getAccountsData, getILSTransactions };
    },
  );

  vi.mocked(init).mockResolvedValue({ hapoalim, close } as unknown as Awaited<ReturnType<typeof init>>);

  return { hapoalim, getAccountsData, getILSTransactions, close };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CREDS: PoalimSourceConfig = {
  id: 'src-poalim-1',
  userCode: 'user1',
  password: 'pass1',
  options: { isBusinessAccount: true },
};

const DATE_FROM = new Date('2023-01-01');
const DATE_TO = new Date('2024-01-01');

function makeOtpManager(otp = '123456'): { manager: OtpManager; waitForOtp: ReturnType<typeof vi.fn> } {
  const waitForOtp = vi.fn().mockResolvedValue(otp);
  return { manager: { waitForOtp }, waitForOtp };
}

const noop = () => {};

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});

describe('scrapePoalim — OTP hook', () => {
  it('calls waitForOtp with the sourceId and OTP_TIMEOUT_MS (5 min) when OTP is triggered', async () => {
    makeScraperMock({ callOtpCallback: true });
    const { manager, waitForOtp } = makeOtpManager();

    await scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop);

    expect(waitForOtp).toHaveBeenCalledOnce();
    expect(waitForOtp).toHaveBeenCalledWith(CREDS.id, 5 * 60 * 1_000);
  });

  it('does not call waitForOtp when scraper does not trigger OTP', async () => {
    makeScraperMock({ callOtpCallback: false });
    const { manager, waitForOtp } = makeOtpManager();

    await scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop);

    expect(waitForOtp).not.toHaveBeenCalled();
  });
});

describe('scrapePoalim — successful scrape', () => {
  it('returns the validated ILS payload', async () => {
    makeScraperMock();
    const { manager } = makeOtpManager();

    const result = await scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop);

    expect(result.transactions).toHaveLength(1);
    expect(result.retrievalTransactionData.accountNumber).toBe(100_000);
  });

  it('passes credentials and isBusiness flag to the hapoalim scraper', async () => {
    const { hapoalim } = makeScraperMock();
    const { manager } = makeOtpManager();

    await scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop);

    expect(hapoalim).toHaveBeenCalledWith(
      { userCode: CREDS.userCode, password: CREDS.password },
      expect.objectContaining({ isBusiness: true }),
    );
  });

  it('closes the browser even when an error occurs', async () => {
    const { close } = makeScraperMock({ ilsData: { completely: 'wrong' } });
    const { manager } = makeOtpManager();

    await expect(scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the browser on success', async () => {
    const { close } = makeScraperMock();
    const { manager } = makeOtpManager();

    await scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop);

    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapePoalim — validation errors propagate', () => {
  it('throws PayloadValidationError when ILS data does not match schema', async () => {
    makeScraperMock({ ilsData: { completely: 'wrong', shape: true } });
    const { manager } = makeOtpManager();

    await expect(scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop)).rejects.toBeInstanceOf(
      PayloadValidationError,
    );
  });

  it('throws when hapoalim returns Unknown Error', async () => {
    vi.mocked(init).mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue('Unknown Error'),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof init>>);
    const { manager } = makeOtpManager();

    await expect(scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop)).rejects.toThrow(
      'Hapoalim login failed',
    );
  });

  it('throws when no accounts are returned', async () => {
    vi.mocked(init).mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue({
        getAccountsData: vi.fn().mockResolvedValue({ data: [], isValid: true }),
        getILSTransactions: vi.fn(),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof init>>);
    const { manager } = makeOtpManager();

    await expect(scrapePoalim(CREDS, DATE_FROM, DATE_TO, manager, noop)).rejects.toThrow(
      'No Hapoalim accounts found',
    );
  });
});
