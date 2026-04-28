import { describe, expect, it } from 'vitest';
import { PayloadValidationError, validatePayload } from '../validate-payload.js';

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
    const result = validatePayload('cal', {
      result: { bankAccounts: [] },
      statusCode: 1,
      statusDescription: 'OK',
    });
    expect(result.statusCode).toBe(1);
  });

  it('accepts a minimal discount payload', () => {
    const result = validatePayload('discount', {
      CurrentAccountLastTransactions: {
        CurrentAccountInfo: { AccountBalance: 5000, AccountCurrencyCode: 'ILS' },
        OperationEntry: [],
      },
    });
    expect(
      result.CurrentAccountLastTransactions.CurrentAccountInfo.AccountBalance,
    ).toBe(5000);
  });

  it('accepts a minimal max payload', () => {
    const result = validatePayload('max', { result: { transactions: [] }, returnCode: 0 });
    expect(result.returnCode).toBe(0);
  });

  it('accepts max with null result', () => {
    const result = validatePayload('max', { result: null, returnCode: 1 });
    expect(result.result).toBeNull();
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
      validatePayload('discount', {
        CurrentAccountLastTransactions: {
          CurrentAccountInfo: { AccountCurrencyCode: 'ILS' }, // missing AccountBalance
          OperationEntry: [],
        },
      }),
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
