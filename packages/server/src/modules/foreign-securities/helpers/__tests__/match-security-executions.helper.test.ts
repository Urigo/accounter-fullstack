import { describe, expect, it } from 'vitest';
import {
  matchExecutionsToTransactions,
  matchSecurityExecutions,
  type AccountTuple,
  type MatchableExecution,
  type MatchableTransaction,
} from '../match-security-executions.helper.js';

const ACCOUNT_ID = 'account-1';
const OTHER_ACCOUNT_ID = 'account-2';

const ACCOUNT: AccountTuple = { bankNumber: 12, branchNumber: 615, accountNumber: 100000 };
const OTHER_ACCOUNT: AccountTuple = { bankNumber: 12, branchNumber: 615, accountNumber: 100001 };

const accountTuples = new Map([
  [ACCOUNT_ID, ACCOUNT],
  [OTHER_ACCOUNT_ID, OTHER_ACCOUNT],
]);

// Dates are constructed the way `DATE` columns come back from node-postgres: local midnight.
const date = (value: string) => new Date(`${value}T00:00:00`);

/** A buy: the account is debited on the execution's value date. */
function transaction(overrides: Partial<MatchableTransaction> = {}): MatchableTransaction {
  return {
    id: 't1',
    charge_id: 'c1',
    amount: '-1000.00',
    currency: 'USD',
    debit_date: date('2024-03-12'),
    debit_date_override: null,
    account_id: ACCOUNT_ID,
    ...overrides,
  };
}

function execution(overrides: Partial<MatchableExecution> = {}): MatchableExecution {
  return {
    id: 'e1',
    security: '5129523',
    bank_number: ACCOUNT.bankNumber,
    branch_number: ACCOUNT.branchNumber,
    account_number: ACCOUNT.accountNumber,
    trade_date: date('2024-03-10'),
    value_date: date('2024-03-12'),
    trade_type: 'קניה',
    trade_currency: 'דולר ארה"ב',
    settlement_currency: null,
    net_value_trade_currency: '1000.00',
    net_value_settlement_currency: null,
    net_value_nis: '3700.00',
    ...overrides,
  };
}

const match = (
  transactions: MatchableTransaction[],
  executions: MatchableExecution[],
): Map<string, MatchableTransaction> =>
  matchExecutionsToTransactions(transactions, executions, accountTuples);

describe('matchExecutionsToTransactions', () => {
  it('pairs an execution with the cash movement on its value date', () => {
    const matched = match([transaction()], [execution()]);

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('requires the value date to be the effective debit date, not the trade date', () => {
    expect(match([transaction({ debit_date: date('2024-03-10') })], [execution()]).size).toBe(0);
  });

  it('prefers a debit date override, as everywhere else', () => {
    const matched = match(
      [transaction({ debit_date: date('2024-03-31'), debit_date_override: date('2024-03-12') })],
      [execution()],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('drops a transaction with no debit date', () => {
    expect(match([transaction({ debit_date: null })], [execution()]).size).toBe(0);
  });

  it('drops an execution with no value date', () => {
    expect(match([transaction()], [execution({ value_date: null })]).size).toBe(0);
  });

  it('compares the amount exactly — a near miss is a different event', () => {
    expect(match([transaction({ amount: '-1000.01' })], [execution()]).size).toBe(0);
  });

  it('ignores trailing zeros, which the two sources spell differently', () => {
    const matched = match([transaction({ amount: '-1000' })], [execution()]);

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('compares the net value quoted in the transaction currency', () => {
    // Same execution, booked in ILS: the NIS column is the comparable one.
    const matched = match(
      [transaction({ amount: '-3700.00', currency: 'ILS' })],
      [execution({ trade_currency: 'דולר ארה"ב' })],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('reads the settlement currency column when that is what the transaction is in', () => {
    const matched = match(
      [transaction({ amount: '-920.00', currency: 'EUR' })],
      [execution({ settlement_currency: 'EUR', net_value_settlement_currency: '920.00' })],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('will not compare across currencies', () => {
    expect(
      match(
        [transaction({ amount: '-1000.00', currency: 'EUR' })],
        [execution({ net_value_nis: null })],
      ).size,
    ).toBe(0);
  });

  it('requires the direction the trade type implies', () => {
    // A buy takes money out; a credit of the same size is some other event.
    expect(match([transaction({ amount: '1000.00' })], [execution()]).size).toBe(0);
  });

  it('matches a sale against a credit', () => {
    const matched = match(
      [transaction({ amount: '1000.00' })],
      [execution({ trade_type: 'מכירה' })],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('leaves the sign unconstrained for actions with no cash direction', () => {
    const matched = match(
      [transaction({ amount: '1000.00' })],
      [execution({ trade_type: 'העברה לזכות הפקדון' })],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('will not cross-match between two portfolios', () => {
    expect(match([transaction({ account_id: OTHER_ACCOUNT_ID })], [execution()]).size).toBe(0);
  });

  it('skips a transaction whose account has no Poalim identity', () => {
    expect(match([transaction({ account_id: 'unmapped-account' })], [execution()]).size).toBe(0);
  });

  it('pairs one-to-one when a security is executed twice the same day for the same amount', () => {
    const matched = match(
      [transaction({ id: 't1' }), transaction({ id: 't2' })],
      [execution({ id: 'e1' }), execution({ id: 'e2' })],
    );

    expect([...matched.entries()].map(([executionId, t]) => [executionId, t.id])).toEqual([
      ['e1', 't1'],
      ['e2', 't2'],
    ]);
  });

  it('leaves a third execution unmatched when only two cash movements exist', () => {
    const matched = match(
      [transaction({ id: 't1' }), transaction({ id: 't2' })],
      [execution({ id: 'e1' }), execution({ id: 'e2' }), execution({ id: 'e3' })],
    );

    expect(matched.size).toBe(2);
    expect(matched.has('e3')).toBe(false);
  });

  it('consumes executions oldest first, whatever order they arrive in', () => {
    const older = execution({ id: 'e-late-id', trade_date: date('2024-03-08') });
    const newer = execution({ id: 'e-early-id', trade_date: date('2024-03-10') });

    const matched = match([transaction()], [newer, older]);

    expect(matched.has('e-late-id')).toBe(true);
    expect(matched.has('e-early-id')).toBe(false);
  });
});

describe('matchSecurityExecutions', () => {
  it('groups the matched executions by security key', () => {
    const matched = matchSecurityExecutions(
      [transaction({ id: 't1' }), transaction({ id: 't2', amount: '-2000.00' })],
      [
        execution({ id: 'e1', security: '5129523' }),
        execution({ id: 'e2', security: '7654321', net_value_trade_currency: '2000.00' }),
      ],
      accountTuples,
    );

    expect([...matched.keys()].sort()).toEqual(['5129523', '7654321']);
    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['e1']);
    expect(matched.get('7654321')?.map(e => e.id)).toEqual(['e2']);
  });

  it('omits a security whose executions match nothing', () => {
    const matched = matchSecurityExecutions(
      [transaction()],
      [execution({ id: 'e2', security: '7654321', net_value_trade_currency: '9999.00' })],
      accountTuples,
    );

    expect(matched.size).toBe(0);
  });

  it('orders a security group by trade date', () => {
    const matched = matchSecurityExecutions(
      [transaction({ id: 't1' }), transaction({ id: 't2' })],
      [
        execution({ id: 'e-newer', trade_date: date('2024-03-11') }),
        execution({ id: 'e-older', trade_date: date('2024-03-09') }),
      ],
      accountTuples,
    );

    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['e-older', 'e-newer']);
  });
});
