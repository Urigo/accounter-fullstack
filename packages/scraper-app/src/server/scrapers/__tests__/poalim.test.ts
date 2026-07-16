import { describe, expect, it, vi } from 'vitest';
import { OtpManager } from '../../otp-manager.js';
import { scrapePoalim } from '../poalim.js';

const VALID_ACCOUNTS = [{ bankNumber: 12, branchNumber: 600, accountNumber: 100_000 }];

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

const VALID_FOREIGN_DATA = {
  balancesAndLimitsDataList: [
    { currencySwiftCode: 'USD', currencyCode: 1, transactions: [] },
  ],
};

const VALID_SWIFT_DATA = { swiftsList: [] };

function makeScraper(overrides: Record<string, unknown> = {}) {
  return {
    getAccountsData: vi.fn().mockResolvedValue({ data: VALID_ACCOUNTS, isValid: true }),
    getILSTransactions: vi.fn().mockResolvedValue({ data: VALID_ILS_DATA, isValid: true }),
    getForeignTransactions: vi.fn().mockResolvedValue({ data: VALID_FOREIGN_DATA, isValid: true }),
    getForeignSwiftTransactions: vi.fn().mockResolvedValue({ data: VALID_SWIFT_DATA, isValid: true }),
    ...overrides,
  };
}

const CREDS = { id: 'src-1', userCode: 'user', password: 'pass' };
const noop = () => {};

vi.mock('@accounter/modern-poalim-scraper', () => ({
  init: vi.fn(),
}));

vi.mock('../../account-discovery.js', () => ({
  registerDiscoveredAccounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../vault-store.js', () => ({
  getVault: vi.fn().mockReturnValue({
    accountRecords: [
      { id: 'rec-1', sourceId: 'src-1', sourceType: 'poalim', accountNumber: '600-100000', status: 'accepted' },
    ],
  }),
}));

async function getInitMock() {
  const mod = await import('@accounter/modern-poalim-scraper');
  return mod.init as ReturnType<typeof vi.fn>;
}

describe('scrapePoalim — happy path', () => {
  it('resolves with typed ILS, foreign, and swift payloads', async () => {
    const scraper = makeScraper();
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop);

    expect(result).toHaveLength(1);
    expect(result[0].ils!.retrievalTransactionData.accountNumber).toBe(100_000);
    expect(result[0].foreign).toBeDefined();
    expect(result[0].swift).toBeDefined();
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({ hapoalim: vi.fn().mockResolvedValue(makeScraper()), close });

    await scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop);

    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapePoalim — OTP path', () => {
  it('resolves with OTP when submitOtp is called after waitForOtp', async () => {
    const otpManager = new OtpManager();
    const emit = vi.fn();

    const scraper = makeScraper();
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockImplementation(async (_creds: unknown, opts: { otpCallback?: () => Promise<string> }) => {
        // Simulate scraper triggering OTP
        if (opts?.otpCallback) {
          // Resolve the OTP externally while waitForOtp is pending
          setTimeout(() => otpManager.submitOtp('src-1', '123456'), 10);
          const otp = await opts.otpCallback();
          expect(otp).toBe('123456');
        }
        return scraper;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapePoalim(CREDS, new Date(), new Date(), true, otpManager, emit);

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'otp-required', sourceId: 'src-1' }));
    expect(result).toHaveLength(1);
  });
});

describe('scrapePoalim — Unknown Error', () => {
  it('throws when hapoalim returns "Unknown Error"', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue('Unknown Error'),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow('Hapoalim login failed');
  });

  it('calls close() even when Unknown Error is thrown', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue('Unknown Error'),
      close,
    });

    await expect(scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapePoalim — schema validation failures are surfaced', () => {
  it('throws (not silently returns empty) when accounts data fails schema validation', async () => {
    // Regression: the scraper reports isValid:false with data:null on a failed validation.
    // Previously only `data` was read, so this looked like "no accounts" and the run reported
    // success with no data. It must now surface as an error instead.
    const scraper = makeScraper({
      getAccountsData: vi.fn().mockResolvedValue({
        data: null,
        isValid: false,
        errors: [{ message: 'expected array, received object' }],
      }),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow('accounts data failed schema validation');
  });

  it('throws when ILS data fails schema validation', async () => {
    const scraper = makeScraper({
      getILSTransactions: vi.fn().mockResolvedValue({
        data: null,
        isValid: false,
        errors: [{ message: 'transactions: expected array' }],
      }),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow('ILS transactions failed schema validation');
  });

  it('throws when foreign data is unreachable / fails schema validation', async () => {
    const scraper = makeScraper({
      getForeignTransactions: vi.fn().mockResolvedValue({
        data: null,
        isValid: false,
        errors: 'Data seems unreachable. Is the account active?',
      }),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow('foreign transactions failed schema validation');
  });

  it('throws when SWIFT data fails schema validation', async () => {
    const scraper = makeScraper({
      getForeignSwiftTransactions: vi.fn().mockResolvedValue({
        data: null,
        isValid: false,
        errors: [{ message: 'swiftsList: expected array' }],
      }),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow('SWIFT transactions failed schema validation');
  });

  it('calls close() when a schema validation error is thrown', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const scraper = makeScraper({
      getAccountsData: vi.fn().mockResolvedValue({ data: null, isValid: false, errors: [] }),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      hapoalim: vi.fn().mockResolvedValue(scraper),
      close,
    });

    await expect(
      scrapePoalim(CREDS, new Date(), new Date(), true, new OtpManager(), noop),
    ).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
