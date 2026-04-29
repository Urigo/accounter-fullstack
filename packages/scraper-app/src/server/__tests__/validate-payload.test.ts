import { describe, expect, it, afterEach } from 'vitest';
import { PayloadValidationError, validatePayload } from '../validate-payload.js';
import { _resetRunState, startRun, type ScrapeTask } from '../scrape-runner.js';
import type { ServerMessage } from '../../shared/ws-protocol.js';

describe('validatePayload — valid fixtures', () => {
  it('accepts a minimal poalim-ils payload', () => {
    const result = validatePayload('poalim-ils', {
      transactions: [
        {
          activityDescription: 'Credit',
          activityTypeCode: 1,
          eventAmount: 100,
          eventDate: 20240101,
          serialNumber: 1,
          transactionType: 'REGULAR',
          currentBalance: 5000,
          referenceNumber: 12345,
        },
      ],
      retrievalTransactionData: { accountNumber: 100000, branchNumber: 600, bankNumber: 12 },
    });
    expect(result.transactions).toHaveLength(1);
  });

  it('accepts a poalim-ils payload with extra fields (passthrough)', () => {
    const result = validatePayload('poalim-ils', {
      transactions: [],
      retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      unknownField: 'should be kept',
    });
    expect((result as Record<string, unknown>)['unknownField']).toBe('should be kept');
  });

  it('accepts a minimal poalim-foreign payload', () => {
    const result = validatePayload('poalim-foreign', {
      balancesAndLimitsDataList: [
        {
          currencySwiftCode: 'USD',
          currencyCode: 1,
          transactions: [],
        },
      ],
    });
    expect(result.balancesAndLimitsDataList).toHaveLength(1);
  });

  it('accepts a minimal poalim-swift payload', () => {
    const result = validatePayload('poalim-swift', { swiftsList: [] });
    expect(result.swiftsList).toHaveLength(0);
  });

  it('accepts a minimal isracard payload', () => {
    const result = validatePayload('isracard', {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
      },
    });
    expect(result.Header.Status).toBe('1');
  });

  it('accepts amex with the same shape as isracard', () => {
    const result = validatePayload('amex', {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
      },
    });
    expect(result.Header.Status).toBe('1');
  });

  it('accepts a minimal cal payload', () => {
    const result = validatePayload('cal', [
      { card: '1234', month: '2024-01', transactions: [] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.card).toBe('1234');
  });

  it('accepts a minimal discount payload', () => {
    const result = validatePayload('discount', [
      { accountNumber: 'ACC-001', month: '2024-01', balance: 5000, transactions: [] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.accountNumber).toBe('ACC-001');
    expect(result[0]!.balance).toBe(5000);
  });

  it('accepts a minimal max payload', () => {
    const result = validatePayload('max', [{ accountNumber: '1234', txns: [] }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.accountNumber).toBe('1234');
  });

  it('accepts an empty max payload', () => {
    const result = validatePayload('max', []);
    expect(result).toEqual([]);
  });

  it('accepts a currency-rates payload', () => {
    const result = validatePayload('currency-rates', [
      { date: '2024-01-01', currency: 'USD', rate: 3.712 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.currency).toBe('USD');
  });
});

describe('validatePayload — invalid fixtures', () => {
  it('throws PayloadValidationError for wrong transactions type in poalim-ils', () => {
    expect(() =>
      validatePayload('poalim-ils', {
        transactions: 'not-an-array',
        retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      }),
    ).toThrow(PayloadValidationError);
  });

  it('error message includes the payload type', () => {
    try {
      validatePayload('poalim-ils', { transactions: 42 });
    } catch (e) {
      expect(e).toBeInstanceOf(PayloadValidationError);
      expect((e as PayloadValidationError).message).toContain('poalim-ils');
      expect((e as PayloadValidationError).payloadType).toBe('poalim-ils');
    }
  });

  it('throws for missing required field in discount payload', () => {
    expect(() =>
      validatePayload('discount', [
        { accountNumber: 'ACC-001', month: '2024-01' }, // missing balance and transactions
      ]),
    ).toThrow(PayloadValidationError);
  });

  it('throws for invalid transaction type in poalim-ils', () => {
    expect(() =>
      validatePayload('poalim-ils', {
        transactions: [
          {
            activityDescription: 'X',
            activityTypeCode: 1,
            eventAmount: 100,
            eventDate: 20240101,
            serialNumber: 1,
            transactionType: 'INVALID_TYPE',
            currentBalance: 5000,
            referenceNumber: 1,
          },
        ],
        retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      }),
    ).toThrow(PayloadValidationError);
  });

  it('throws for wrong currency in currency-rates', () => {
    expect(() =>
      validatePayload('currency-rates', [{ date: '2024-01-01', currency: 'XYZ', rate: 1.0 }]),
    ).toThrow(PayloadValidationError);
  });
});

describe('runner integration — task-error on PayloadValidationError', () => {
  afterEach(() => {
    _resetRunState();
  });

  it('emits task-error (not a crash) when validatePayload throws inside run()', async () => {
    const events: ServerMessage[] = [];

    const task: ScrapeTask = {
      sourceId: 'bad-src',
      nickname: 'bad-src',
      type: 'poalim',
      run: async () => {
        // Deliberately pass invalid data to trigger PayloadValidationError
        validatePayload('poalim-ils', { transactions: 'not-an-array' });
        return { inserted: 0, skipped: 0, insertedIds: [] };
      },
    };

    await startRun([task], false, msg => events.push(msg));

    const taskError = events.find(e => e.type === 'task-error');
    expect(taskError).toBeTruthy();
    expect((taskError as { sourceId: string }).sourceId).toBe('bad-src');
    expect(events.at(-1)).toMatchObject({ type: 'run-complete', totalInserted: 0, totalSkipped: 0 });
  });
});
