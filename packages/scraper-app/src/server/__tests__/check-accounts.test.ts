import { afterEach, describe, expect, it } from 'vitest';
import { checkAccounts } from '../check-accounts.js';
import type { AccountRecord } from '../check-accounts.js';
import { _resetRunState, startRun, type ScrapeTask } from '../scrape-runner.js';
import type { ServerMessage } from '../../shared/ws-protocol.js';

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

const calPayload = [
  { card: 'ACC-1', month: '2024-01', transactions: [] },
  { card: 'ACC-2', month: '2024-01', transactions: [] },
];

const maxPayload = [
  { accountNumber: '7', txns: [] },
  { accountNumber: '8', txns: [] },
];

const discountPayload = [
  { accountNumber: 'ACC-001', month: '2024-01', balance: 5000, transactions: [] },
  { accountNumber: 'ACC-002', month: '2024-01', balance: 3000, transactions: [] },
];

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

  it('unknown when account has pending status', () => {
    const known = [makeRecord('poalim', '100000', 'pending')];
    const result = checkAccounts('poalim', poalimPayload, known);
    expect(result.accepted).toEqual([]);
    expect(result.unknown).toEqual(['100000']);
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
  it('classifies accountNumber identifiers from payload', () => {
    const known = [
      makeRecord('discount', 'ACC-001', 'accepted'),
      makeRecord('discount', 'ACC-002', 'ignored'),
    ];
    const result = checkAccounts('discount', discountPayload, known);
    expect(result.accepted).toEqual(['ACC-001']);
    expect(result.ignored).toEqual(['ACC-002']);
    expect(result.unknown).toEqual([]);
  });

  it('returns unknown for unrecognised accountNumber', () => {
    const result = checkAccounts('discount', discountPayload, []);
    expect(result.unknown).toEqual(['ACC-001', 'ACC-002']);
    expect(result.accepted).toEqual([]);
  });

  it('deduplicates accountNumber across multiple months for the same account', () => {
    const sameAccountTwoMonths = [
      { accountNumber: 'ACC-001', month: '2024-01', balance: 5000, transactions: [] },
      { accountNumber: 'ACC-001', month: '2024-02', balance: 4800, transactions: [] },
    ];
    const result = checkAccounts('discount', sameAccountTwoMonths, []);
    expect(result.unknown).toEqual(['ACC-001']);
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
  it('classifies card identifiers', () => {
    const known = [
      makeRecord('cal', 'ACC-1', 'accepted'),
      makeRecord('cal', 'ACC-2', 'ignored'),
    ];
    const result = checkAccounts('cal', calPayload, known);
    expect(result.accepted).toEqual(['ACC-1']);
    expect(result.ignored).toEqual(['ACC-2']);
    expect(result.unknown).toEqual([]);
  });

  it('returns unknown for unrecognised card', () => {
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

  it('deduplicates accountNumber across multiple entries for the same card', () => {
    const twoEntriesSameCard = [
      { accountNumber: '7', txns: [] },
      { accountNumber: '7', txns: [] },
    ];
    const result = checkAccounts('max', twoEntriesSameCard, []);
    expect(result.unknown).toEqual(['7']);
  });

  it('returns empty arrays when there are no accounts', () => {
    const result = checkAccounts('max', [], []);
    expect(result).toEqual({ accepted: [], ignored: [], unknown: [] });
  });
});

describe('runner integration — task-blocked on unknown accounts', () => {
  afterEach(() => {
    _resetRunState();
  });

  it('emits task-blocked (not a crash) when checkAccounts finds unknown accounts', async () => {
    const events: ServerMessage[] = [];
    const emit = (msg: ServerMessage) => events.push(msg);

    const task: ScrapeTask = {
      sourceId: 'poalim-src',
      nickname: 'poalim-src',
      type: 'poalim',
      run: async () => {
        const check = checkAccounts('poalim', poalimPayload, []);
        if (check.unknown.length > 0) {
          emit({ type: 'task-blocked', sourceId: 'poalim-src', sourceType: 'poalim', unknownAccounts: check.unknown });
          return { inserted: 0, skipped: 0, insertedIds: [] };
        }
        return { inserted: 1, skipped: 0, insertedIds: ['x'] };
      },
    };

    await startRun([task], false, emit);

    const blocked = events.find(e => e.type === 'task-blocked');
    expect(blocked).toBeTruthy();
    expect((blocked as { unknownAccounts: string[] }).unknownAccounts).toContain('100000');
    expect(events.at(-1)).toMatchObject({ type: 'run-complete', totalInserted: 0, totalSkipped: 0 });
  });

  it('continues remaining tasks after a blocked task', async () => {
    const events: ServerMessage[] = [];
    const emit = (msg: ServerMessage) => events.push(msg);

    const blockedTask: ScrapeTask = {
      sourceId: 'src-1',
      nickname: 'src-1',
      type: 'poalim',
      run: async () => {
        const check = checkAccounts('poalim', poalimPayload, []);
        if (check.unknown.length > 0) {
          emit({ type: 'task-blocked', sourceId: 'src-1', sourceType: 'poalim', unknownAccounts: check.unknown });
          return { inserted: 0, skipped: 0, insertedIds: [] };
        }
        return { inserted: 1, skipped: 0, insertedIds: ['x'] };
      },
    };

    const normalTask: ScrapeTask = {
      sourceId: 'src-2',
      nickname: 'src-2',
      type: 'poalim',
      run: async () => ({ inserted: 2, skipped: 1, insertedIds: ['a', 'b'] }),
    };

    await startRun([blockedTask, normalTask], false, emit);

    expect(events.some(e => e.type === 'task-blocked')).toBe(true);
    expect(events.some(e => e.type === 'task-done' && 'sourceId' in e && e.sourceId === 'src-2')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'run-complete', totalInserted: 2, totalSkipped: 1 });
  });
});
