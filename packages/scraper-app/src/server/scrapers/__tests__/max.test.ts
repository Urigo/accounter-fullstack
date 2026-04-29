import { describe, expect, it, vi } from 'vitest';
import { PayloadValidationError } from '../../validate-payload.js';
import { scrapeMax } from '../max.js';

const CREDS = { id: 'src-1', username: 'user', password: 'pass' };
const DATE_FROM = new Date('2024-01-01');
const DATE_TO = new Date('2024-01-31');
const noop = () => {};

const VALID_PAYLOAD = [
  { accountNumber: '1234', txns: [] },
];

vi.mock('@accounter/modern-poalim-scraper', () => ({
  init: vi.fn(),
}));

async function getInitMock() {
  const mod = await import('@accounter/modern-poalim-scraper');
  return mod.init as ReturnType<typeof vi.fn>;
}

describe('scrapeMax — happy path', () => {
  it('resolves with a validated MaxPayload (array of accounts)', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue(VALID_PAYLOAD),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeMax(CREDS, DATE_FROM, DATE_TO, noop);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]!.accountNumber).toBe('1234');
    expect(result[0]!.txns).toEqual([]);
  });

  it('passes startDate to the scraper via MaxOptions', async () => {
    const maxFn = vi.fn().mockResolvedValue({
      getTransactions: vi.fn().mockResolvedValue(VALID_PAYLOAD),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({ max: maxFn, close: vi.fn().mockResolvedValue(undefined) });

    await scrapeMax(CREDS, DATE_FROM, DATE_TO, noop);

    expect(maxFn).toHaveBeenCalledWith(
      { username: 'user', password: 'pass' },
      { startDate: DATE_FROM },
    );
  });

  it('returns multiple accounts when the scraper reports them', async () => {
    const multiAccountPayload = [
      { accountNumber: 'ACC-1', txns: [] },
      { accountNumber: 'ACC-2', txns: [] },
    ];
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue(multiAccountPayload),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeMax(CREDS, DATE_FROM, DATE_TO, noop);
    expect(result.map(a => a.accountNumber)).toEqual(['ACC-1', 'ACC-2']);
  });

  it('calls close() even on success', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue(VALID_PAYLOAD),
      }),
      close,
    });

    await scrapeMax(CREDS, DATE_FROM, DATE_TO, noop);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('scrapeMax — invalid payload', () => {
  it('throws PayloadValidationError when data fails schema validation', async () => {
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue('not-an-array'),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    await expect(scrapeMax(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toBeInstanceOf(
      PayloadValidationError,
    );
  });

  it('calls close() even on validation error', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue('not-an-array'),
      }),
      close,
    });

    await expect(scrapeMax(CREDS, DATE_FROM, DATE_TO, noop)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
  });
});
