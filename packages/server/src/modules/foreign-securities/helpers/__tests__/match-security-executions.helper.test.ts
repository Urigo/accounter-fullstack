import { describe, expect, it } from 'vitest';
import {
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

function transaction(overrides: Partial<MatchableTransaction> = {}): MatchableTransaction {
  return {
    id: 't1',
    amount: '-1000.00',
    event_date: date('2024-03-10'),
    debit_date: null,
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
    value_date: null,
    settlement_date: null,
    payment_date: null,
    net_value_trade_currency: '1000.00',
    net_value_settlement_currency: null,
    net_value_nis: null,
    ...overrides,
  };
}

describe('matchSecurityExecutions', () => {
  it('matches on account, date and amount, grouped by security key', () => {
    const matched = matchSecurityExecutions([transaction()], [execution()], accountTuples);

    expect([...matched.keys()]).toEqual(['5129523']);
    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['e1']);
  });

  it('disambiguates same-day executions of the same security by amount', () => {
    const matched = matchSecurityExecutions(
      [transaction({ amount: '-2500.50' })],
      [
        execution({ id: 'wrong-amount', net_value_trade_currency: '1000.00' }),
        execution({ id: 'right-amount', net_value_trade_currency: '2500.50' }),
      ],
      accountTuples,
    );

    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['right-amount']);
  });

  it('compares magnitudes, so a sell (credit) still matches its execution', () => {
    const matched = matchSecurityExecutions(
      [transaction({ amount: '1000.00' })],
      [execution({ net_value_trade_currency: '-1000.00' })],
      accountTuples,
    );

    expect(matched.get('5129523')).toHaveLength(1);
  });

  it('falls back to the settlement-currency and NIS net values', () => {
    const matched = matchSecurityExecutions(
      [transaction({ amount: '-3600.25' })],
      [
        execution({
          net_value_trade_currency: null,
          net_value_nis: '3600.25',
        }),
      ],
      accountTuples,
    );

    expect(matched.get('5129523')).toHaveLength(1);
  });

  it('drops an execution whose amount is outside the tolerance', () => {
    const matched = matchSecurityExecutions(
      [transaction({ amount: '-1000.00' })],
      [execution({ net_value_trade_currency: '1000.02' })],
      accountTuples,
    );

    expect(matched.size).toBe(0);
  });

  it('accepts an amount at the tolerance boundary', () => {
    const matched = matchSecurityExecutions(
      [transaction({ amount: '-1000.00' })],
      [execution({ net_value_trade_currency: '1000.01' })],
      accountTuples,
    );

    expect(matched.get('5129523')).toHaveLength(1);
  });

  it('matches an execution whose settlement date lands on the debit date', () => {
    const matched = matchSecurityExecutions(
      [transaction({ event_date: date('2024-03-10'), debit_date: date('2024-03-12') })],
      [execution({ trade_date: date('2024-02-01'), settlement_date: date('2024-03-12') })],
      accountTuples,
    );

    expect(matched.get('5129523')).toHaveLength(1);
  });

  it('honours the debit date override over the raw debit date', () => {
    const matched = matchSecurityExecutions(
      [
        transaction({
          event_date: date('2024-01-01'),
          debit_date: date('2024-01-02'),
          debit_date_override: date('2024-03-12'),
        }),
      ],
      [execution({ trade_date: date('2024-03-12') })],
      accountTuples,
    );

    expect(matched.get('5129523')).toHaveLength(1);
  });

  it('respects the date window edges', () => {
    const withinWindow = matchSecurityExecutions(
      [transaction()],
      [execution({ trade_date: date('2024-03-15') })],
      accountTuples,
      { dateWindowDays: 5 },
    );
    expect(withinWindow.get('5129523')).toHaveLength(1);

    const outsideWindow = matchSecurityExecutions(
      [transaction()],
      [execution({ trade_date: date('2024-03-16') })],
      accountTuples,
      { dateWindowDays: 5 },
    );
    expect(outsideWindow.size).toBe(0);
  });

  it('does not match an execution from another account', () => {
    const matched = matchSecurityExecutions(
      [transaction()],
      [execution({ account_number: OTHER_ACCOUNT.accountNumber })],
      new Map([[ACCOUNT_ID, ACCOUNT]]),
    );

    expect(matched.size).toBe(0);
  });

  it('skips transactions whose account has no resolved Poalim tuple', () => {
    const matched = matchSecurityExecutions([transaction()], [execution()], new Map());

    expect(matched.size).toBe(0);
  });

  it('returns each matched execution once, sorted by trade date', () => {
    const matched = matchSecurityExecutions(
      [transaction({ id: 'trade' }), transaction({ id: 'duplicate-leg' })],
      [
        execution({ id: 'later', trade_date: date('2024-03-12') }),
        execution({ id: 'earlier', trade_date: date('2024-03-08') }),
      ],
      accountTuples,
    );

    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['earlier', 'later']);
  });

  it('groups matches from several securities under their own keys', () => {
    const matched = matchSecurityExecutions(
      [transaction({ id: 't1', amount: '-1000.00' }), transaction({ id: 't2', amount: '-500.00' })],
      [
        execution({ id: 'a', security: '5129523', net_value_trade_currency: '1000.00' }),
        execution({ id: 'b', security: '77774297', net_value_trade_currency: '500.00' }),
      ],
      accountTuples,
    );

    expect([...matched.keys()].sort()).toEqual(['5129523', '77774297']);
  });
});
