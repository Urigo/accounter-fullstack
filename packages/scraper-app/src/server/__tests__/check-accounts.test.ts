import { describe, expect, it } from 'vitest';
import { checkAccounts } from '../check-accounts.js';
import type { AccountRecord } from '../check-accounts.js';

const poalimPayload = {
  transactions: [],
  retrievalTransactionData: { accountNumber: 100000, branchNumber: 600, bankNumber: 12 },
};

const isracardPayload = {
  Header: { Status: '1', Message: null },
  CardsTransactionsListBean: {
    Index0: {
      '@AllCards': 'AllCards',
      CurrentCardTransactions: [
        { '@cardTransactions': 'CARD-A', txnIsrael: null, txnAbroad: null },
        { '@cardTransactions': 'CARD-B', txnIsrael: null, txnAbroad: null },
      ],
    },
  },
};

const calPayload = {
  result: {
    bankAccounts: [
      { bankName: 'Cal', bankAccountNum: 'ACC-1', debitDates: [] },
      { bankName: 'Cal', bankAccountNum: 'ACC-2', debitDates: [] },
    ],
  },
  statusCode: 1,
  statusDescription: 'OK',
};

const maxPayload = {
  result: {
    transactions: [
      {
        cardIndex: 7,
        categoryId: 1,
        merchantName: 'Shop',
        originalAmount: 100,
        originalCurrency: 'ILS',
        purchaseDate: '2024-01-01',
        uid: 'u1',
        planName: 'regular',
        planTypeId: 1,
      },
      {
        cardIndex: 8,
        categoryId: 1,
        merchantName: 'Market',
        originalAmount: 50,
        originalCurrency: 'ILS',
        purchaseDate: '2024-01-02',
        uid: 'u2',
        planName: 'regular',
        planTypeId: 1,
      },
    ],
  },
  returnCode: 0,
};

const discountPayload = {
  CurrentAccountLastTransactions: {
    CurrentAccountInfo: { AccountBalance: 5000, AccountCurrencyCode: 'ILS' },
    OperationEntry: [],
  },
};

function makeRecord(
  sourceType: AccountRecord['sourceType'],
  accountNumber: string,
  status: AccountRecord['status'] = 'accepted',
): AccountRecord {
  return {
    id: `${sourceType}-${accountNumber}`,
    sourceId: 'src-1',
    sourceType,
    accountNumber,
    status,
  };
}

describe('checkAccounts — poalim', () => {
  it('accepted when account is in known list with accepted status', () => {
    const known = [makeRecord('poalim', '100000', 'accepted')];
    const result = checkAccounts('poalim', poalimPayload, known);
    expect(result.accepted).toEqual(['100000']);
    expect(result.ignored).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it('accepted when account has pending status', () => {
    const known = [makeRecord('poalim', '100000', 'pending')];
    const result = checkAccounts('poalim', poalimPayload, known);
    expect(result.accepted).toEqual(['100000']);
    expect(result.unknown).toEqual([]);
  });

  it('unknown when account is not in known list', () => {
    const result = checkAccounts('poalim', poalimPayload, []);
    expect(result.unknown).toEqual(['100000']);
    expect(result.accepted).toEqual([]);
  });

  it('ignored when account status is ignored', () => {
    const known = [makeRecord('poalim', '100000', 'ignored')];
    const result = checkAccounts('poalim', poalimPayload, known);
    expect(result.ignored).toEqual(['100000']);
    expect(result.accepted).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it('does not match account from a different sourceType', () => {
    const known = [makeRecord('discount', '100000', 'accepted')];
    const result = checkAccounts('poalim', poalimPayload, known);
    expect(result.unknown).toEqual(['100000']);
  });
});

describe('checkAccounts — discount', () => {
  it('returns empty arrays (no identifier in payload)', () => {
    const result = checkAccounts('discount', discountPayload, []);
    expect(result).toEqual({ accepted: [], ignored: [], unknown: [] });
  });
});

describe('checkAccounts — isracard / amex', () => {
  it('classifies each card from CurrentCardTransactions', () => {
    const known = [
      makeRecord('isracard', 'CARD-A', 'accepted'),
      makeRecord('isracard', 'CARD-B', 'ignored'),
    ];
    const result = checkAccounts('isracard', isracardPayload, known);
    expect(result.accepted).toEqual(['CARD-A']);
    expect(result.ignored).toEqual(['CARD-B']);
    expect(result.unknown).toEqual([]);
  });

  it('returns unknown cards not in known list', () => {
    const known = [makeRecord('isracard', 'CARD-A', 'accepted')];
    const result = checkAccounts('isracard', isracardPayload, known);
    expect(result.unknown).toEqual(['CARD-B']);
  });

  it('works the same for amex payload type', () => {
    const known = [makeRecord('amex', 'CARD-A', 'ignored')];
    const result = checkAccounts('amex', isracardPayload, known);
    expect(result.ignored).toEqual(['CARD-A']);
    expect(result.unknown).toEqual(['CARD-B']);
  });

  it('returns empty when there are no cards in payload', () => {
    const emptyPayload = {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
      },
    };
    const result = checkAccounts('isracard', emptyPayload, []);
    expect(result).toEqual({ accepted: [], ignored: [], unknown: [] });
  });

  it('collects identifiers from all Index* keys (Index0, Index1, Index2, …)', () => {
    const multiIndexPayload = {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        Index0: {
          '@AllCards': 'AllCards',
          CurrentCardTransactions: [{ '@cardTransactions': 'CARD-A' }],
        },
        Index1: {
          '@AllCards': 'AllCards',
          CurrentCardTransactions: [{ '@cardTransactions': 'CARD-B' }],
        },
        Index2: {
          '@AllCards': 'AllCards',
          CurrentCardTransactions: [{ '@cardTransactions': 'CARD-C' }],
        },
      },
    };
    const result = checkAccounts('isracard', multiIndexPayload, []);
    expect(result.unknown.sort()).toEqual(['CARD-A', 'CARD-B', 'CARD-C']);
  });

  it('ignores non-Index* keys in CardsTransactionsListBean', () => {
    const payloadWithExtraKeys = {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        Index0: {
          '@AllCards': 'AllCards',
          CurrentCardTransactions: [{ '@cardTransactions': 'CARD-A' }],
        },
        cardIdx: '0',
        card0: { some: 'data' },
      },
    };
    const result = checkAccounts('isracard', payloadWithExtraKeys, []);
    expect(result.unknown).toEqual(['CARD-A']);
  });
});

describe('checkAccounts — cal', () => {
  it('classifies bankAccountNum identifiers', () => {
    const known = [
      makeRecord('cal', 'ACC-1', 'accepted'),
      makeRecord('cal', 'ACC-2', 'ignored'),
    ];
    const result = checkAccounts('cal', calPayload, known);
    expect(result.accepted).toEqual(['ACC-1']);
    expect(result.ignored).toEqual(['ACC-2']);
    expect(result.unknown).toEqual([]);
  });

  it('returns unknown for unrecognised bankAccountNum', () => {
    const result = checkAccounts('cal', calPayload, []);
    expect(result.unknown).toEqual(['ACC-1', 'ACC-2']);
  });
});

describe('checkAccounts — max', () => {
  it('classifies unique cardIndex values from transactions', () => {
    const known = [
      makeRecord('max', '7', 'accepted'),
      makeRecord('max', '8', 'ignored'),
    ];
    const result = checkAccounts('max', maxPayload, known);
    expect(result.accepted).toEqual(['7']);
    expect(result.ignored).toEqual(['8']);
    expect(result.unknown).toEqual([]);
  });

  it('deduplicates cardIndex across multiple transactions', () => {
    const twoTxSameCard = {
      result: {
        transactions: [
          {
            cardIndex: 7,
            categoryId: 1,
            merchantName: 'A',
            originalAmount: 10,
            originalCurrency: 'ILS',
            purchaseDate: '2024-01-01',
            uid: 'u1',
            planName: 'r',
            planTypeId: 1,
          },
          {
            cardIndex: 7,
            categoryId: 1,
            merchantName: 'B',
            originalAmount: 20,
            originalCurrency: 'ILS',
            purchaseDate: '2024-01-02',
            uid: 'u2',
            planName: 'r',
            planTypeId: 1,
          },
        ],
      },
      returnCode: 0,
    };
    const result = checkAccounts('max', twoTxSameCard, []);
    expect(result.unknown).toEqual(['7']);
  });

  it('returns empty arrays when result is null', () => {
    const result = checkAccounts('max', { result: null, returnCode: 1 }, []);
    expect(result).toEqual({ accepted: [], ignored: [], unknown: [] });
  });
});
