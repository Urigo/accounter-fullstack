import { describe, expect, it, vi } from 'vitest';
import { makeMaxTransaction } from '../../__tests__/fixtures/max.js';
import { PayloadValidationError } from '../../validate-payload.js';
import { filterUnreceivedMaxTransactions, scrapeMax } from '../max.js';

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

describe('filterUnreceivedMaxTransactions', () => {
  it('drops transactions whose runtimeReference.type is 0', () => {
    const raw = [
      {
        accountNumber: '1234',
        txns: [
          { uid: 'kept', runtimeReference: { id: '1', type: 1 } },
          { uid: 'dropped', runtimeReference: { id: '2', type: 0 } },
        ],
      },
    ];

    const result = filterUnreceivedMaxTransactions(raw) as typeof raw;
    expect(result[0]!.txns.map(t => t.uid)).toEqual(['kept']);
  });

  it('keeps transactions with a missing or non-numeric runtimeReference', () => {
    const raw = [
      {
        accountNumber: '1234',
        txns: [{ uid: 'no-ref' }, { uid: 'null-ref', runtimeReference: null }],
      },
    ];

    const result = filterUnreceivedMaxTransactions(raw) as typeof raw;
    expect(result[0]!.txns).toHaveLength(2);
  });

  it('passes through payloads that are not shaped like a Max payload', () => {
    expect(filterUnreceivedMaxTransactions('not-an-array')).toBe('not-an-array');
    expect(filterUnreceivedMaxTransactions([{ accountNumber: '1' }])).toEqual([
      { accountNumber: '1' },
    ]);
  });
});

describe('scrapeMax — unreceived transactions', () => {
  it('skips type-0 transactions instead of failing validation on them', async () => {
    const payload = [
      {
        accountNumber: '1234',
        txns: [
          makeMaxTransaction({ uid: 'settled' }),
          // Declared but not received by the credit card company: partial record.
          { uid: 'unreceived', runtimeReference: { id: '2', type: 0 } },
        ],
      },
    ];
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue(payload),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const result = await scrapeMax(CREDS, DATE_FROM, DATE_TO, noop);
    expect(result[0]!.txns.map(t => t.uid)).toEqual(['settled']);
  });

  it('reports the post-filter transaction count', async () => {
    const payload = [
      {
        accountNumber: '1234',
        txns: [
          makeMaxTransaction({ uid: 'settled' }),
          { uid: 'unreceived', runtimeReference: { id: '2', type: 0 } },
        ],
      },
    ];
    const initMock = await getInitMock();
    initMock.mockResolvedValue({
      max: vi.fn().mockResolvedValue({
        getTransactions: vi.fn().mockResolvedValue(payload),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    });

    const emitted: { type: string; transactionCount?: number }[] = [];
    await scrapeMax(CREDS, DATE_FROM, DATE_TO, msg => emitted.push(msg));

    expect(emitted).toEqual([
      { type: 'task-month-fetched', sourceId: 'src-1', month: '1234', transactionCount: 1 },
    ]);
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
