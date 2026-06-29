import { describe, expect, it, vi } from 'vitest';
import { PayloadValidationError } from '../../validate-payload.js';
import { scrapeDiscount } from '../discount.js';

// The scrapers delay 2-5s per month to mimic human behavior and avoid bot
// detection (see PR #3795). Raise the per-test timeout so the default 5s limit
// does not trip multi-month scrapes.
vi.setConfig({ testTimeout: 30_000 });

const CREDS = { id: 'src-1', ID: '123456789', password: 'pass' };
const DATE_FROM = new Date('2024-01-01');
const DATE_TO = new Date('2024-01-31');
const noop = () => {};

const VALID_MONTH_RESULT = {
  success: true,
  accountNumber: 'ACC-001',
  balance: 5000,
  transactions: [
    {
      OperationDate: '20240101',
      ValueDate: '20240101',
      OperationCode: '1',
      OperationDescription: 'Credit',
      OperationAmount: 1000,
      BalanceAfterOperation: 5000,
      OperationNumber: 1,
      OperationDescription2: '',
      OperationDescription3: '',
      OperationBranch: 1,
      OperationBank: 1,
      Channel: 'web',
      ChannelName: 'Web',
      InstituteCode: '1',
      BranchTreasuryNumber: '1',
      Urn: 'urn-1',
      OperationDetailsServiceName: '',
      CommissionChannelCode: '',
      CommissionChannelName: '',
      CommissionTypeName: '',
      BusinessDayDate: '20240101',
      EventName: '',
      CategoryCode: 1,
      CategoryDescCode: 1,
      CategoryDescription: '',
      OperationDescriptionToDisplay: 'Credit',
      OperationOrder: 1,
      IsLastSeen: false,
    },
  ],
};

vi.mock('@accounter/modern-poalim-scraper', () => ({
  init: vi.fn(),
}));

async function getInitMock() {
  const mod = await import('@accounter/modern-poalim-scraper');
  return mod.init as ReturnType<typeof vi.fn>;
}

describe('scrapeDiscount — happy path', () => {
  it('resolves with a validated DiscountPayload containing one entry per month', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue(VALID_MONTH_RESULT),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeDiscount(CREDS, DATE_FROM, DATE_TO, noop);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      accountNumber: 'ACC-001',
      month: '2024-01',
      balance: 5000,
    });
    expect(result[0]!.transactions).toHaveLength(1);
  });

  it('fetches one month per month in the date range', async () => {
    const getMonthTransactions = vi.fn().mockResolvedValue(VALID_MONTH_RESULT);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const threeMonthsFrom = new Date('2024-01-01');
    const threeMonthsTo = new Date('2024-03-31');
    const result = await scrapeDiscount(CREDS, threeMonthsFrom, threeMonthsTo, noop);

    expect(getMonthTransactions).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.month)).toEqual(['2024-01', '2024-02', '2024-03']);
  });

  it('passes the correct month Date to getMonthTransactions', async () => {
    const getMonthTransactions = vi.fn().mockResolvedValue(VALID_MONTH_RESULT);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({ getMonthTransactions }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await scrapeDiscount(CREDS, DATE_FROM, DATE_TO, noop);
    expect(getMonthTransactions).toHaveBeenCalledWith(expect.any(Date));
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue(VALID_MONTH_RESULT),
      }),
      close,
    });

    await scrapeDiscount(CREDS, DATE_FROM, DATE_TO, noop);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeDiscount — invalid payload', () => {
  it('throws PayloadValidationError when data fails schema validation', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          success: true,
          accountNumber: 'ACC-001',
          balance: 0,
          transactions: [{ OperationDate: 'bad' }], // missing required fields
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeDiscount(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toBeInstanceOf(
      PayloadValidationError,
    );
  });

  it('calls close() even on validation error', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      discount: vi.fn().mockResolvedValue({
        getMonthTransactions: vi.fn().mockResolvedValue({
          success: true,
          accountNumber: 'ACC-001',
          balance: 0,
          transactions: [{ OperationDate: 'bad' }],
        }),
      }),
      close,
    });

    await expect(scrapeDiscount(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
