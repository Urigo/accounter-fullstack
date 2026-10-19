import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import { addDaysToTimelessDate } from '../../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  CASH_SETTLEMENT_WINDOW_DAYS,
  executionAmountInCurrency,
  matchExecutionsToTransactions,
  matchSecurityExecutions,
  transactionCashDates,
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

/** A buy: the account is debited on the execution's value date. */
function transaction(overrides: Partial<MatchableTransaction> = {}): MatchableTransaction {
  return {
    id: 't1',
    charge_id: 'c1',
    amount: '-1000.00',
    currency: 'USD',
    event_date: null,
    debit_date: '2024-03-12',
    debit_date_override: null,
    account_id: ACCOUNT_ID,
    source_description: null,
    source_reference: null,
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
    trade_date: '2024-03-10',
    value_date: '2024-03-12',
    trade_type: 'קניה',
    trade_currency: 'דולר ארה"ב',
    settlement_currency: null,
    net_value_trade_currency: '1000.00',
    net_value_settlement_currency: null,
    net_value_nis: '3700.00',
    is_cancel_transaction: null,
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

  it('never pairs cash that moved before the trade', () => {
    expect(match([transaction({ debit_date: '2024-03-09' })], [execution()]).size).toBe(0);
  });

  it('prefers a debit date override, as everywhere else', () => {
    const matched = match(
      [transaction({ debit_date: '2024-03-31', debit_date_override: '2024-03-12' })],
      [execution()],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('drops a transaction with no debit date', () => {
    expect(match([transaction({ debit_date: null })], [execution()]).size).toBe(0);
  });

  it('measures the window from the trade date when an execution has no value date', () => {
    const matched = match([transaction()], [execution({ value_date: null })]);
    expect(matched.get('e1')?.id).toBe('t1');

    expect(
      match([transaction({ debit_date: '2024-03-21' })], [execution({ value_date: null })]).size,
    ).toBe(0);
  });

  it('compares the amount exactly — a near miss is a different event', () => {
    expect(match([transaction({ amount: '-1000.01' })], [execution()]).size).toBe(0);
  });

  it('ignores trailing zeros, which the two sources spell differently', () => {
    const matched = match([transaction({ amount: '-1000' })], [execution()]);

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('compares decimals exactly, past what a double can hold', () => {
    // Both sides parse to the same double, so a Number-based compare would call these equal.
    expect(
      match(
        [transaction({ amount: '-12345678901234567.01' })],
        [execution({ net_value_trade_currency: '12345678901234567.02' })],
      ).size,
    ).toBe(0);

    const matched = match(
      [transaction({ amount: '-12345678901234567.01' })],
      [execution({ net_value_trade_currency: '12345678901234567.010' })],
    );
    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('reads a signed zero as a zero', () => {
    const matched = match(
      [transaction({ amount: '-0.00' })],
      [execution({ net_value_trade_currency: '0' })],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('does not match an amount that is not a plain decimal', () => {
    expect(match([transaction({ amount: 'NaN' })], [execution()]).size).toBe(0);
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

  it('tolerates a trade type it does not know rather than failing the whole charge', () => {
    // The bank adding a word the translation has not learned must not take down a charge; the
    // resolver is where that drift is meant to surface, and only for rows that get served.
    const matched = match(
      [transaction({ amount: '1000.00' })],
      [execution({ trade_type: 'משהו חדש' })],
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
    const older = execution({ id: 'e-late-id', trade_date: '2024-03-08' });
    const newer = execution({ id: 'e-early-id', trade_date: '2024-03-10' });

    const matched = match([transaction()], [newer, older]);

    expect(matched.has('e-late-id')).toBe(true);
    expect(matched.has('e-early-id')).toBe(false);
  });
});

const USD_LABEL = 'דולר ארה"ב';
const ILS_LABEL = 'שקל חדש';
const DIVIDEND = 'דבידנד תשלום';
const SELL = 'מכירה';
const CANCELLED = 'כן';

/*
 * The shapes below are the kinds of movement the two feeds disagree on. They are modelled on real
 * pairs, with every id, account, security key, amount and date made up.
 */
describe('matchExecutionsToTransactions — how the feeds report each kind of movement', () => {
  it('pairs a foreign-currency sale debited before its value date, on its event date', () => {
    // The bank debits the day after the trade and executes on the settlement day the securities
    // feed reports as the value date.
    const matched = match(
      [
        transaction({
          amount: '2500.00',
          debit_date: '2024-03-11',
          event_date: '2024-03-13',
          source_description: 'ניע"ז מכירה 0005129523',
        }),
      ],
      [
        execution({
          trade_type: SELL,
          trade_date: '2024-03-10',
          value_date: '2024-03-13',
          net_value_trade_currency: '2500',
          net_value_settlement_currency: '0',
          net_value_nis: '0',
        }),
      ],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('pairs a domestic shekel trade by the key in its reference and the NIS column', () => {
    // The trade-currency column is left at zero; the cash is reported in the NIS column.
    const shekelBuy = execution({
      security: '1234567',
      trade_date: '2024-03-11',
      trade_currency: ILS_LABEL,
      settlement_currency: ILS_LABEL,
      net_value_trade_currency: '0',
      net_value_settlement_currency: '0',
      net_value_nis: '-48000.50',
    });
    const domesticTransaction = (sourceReference: string) =>
      transaction({
        amount: '-48000.50',
        currency: 'ILS',
        event_date: '2024-03-12',
        source_description: `ני"ע-קניה SEC'TIES PURCH`,
        source_reference: sourceReference,
      });

    expect(match([domesticTransaction('1234567')], [shekelBuy]).get('e1')?.id).toBe('t1');
    expect(match([domesticTransaction('7777777')], [shekelBuy]).size).toBe(0);
  });

  it('pairs a new issue whose cash moved days after the value date', () => {
    const matched = match(
      [
        transaction({
          amount: '-20000.00',
          debit_date: '2024-03-15',
          event_date: '2024-03-15',
          source_description: 'ניע"ז קניה 0012345678',
        }),
      ],
      [
        execution({
          security: '12345678',
          trade_date: '2024-03-10',
          value_date: '2024-03-10',
          net_value_trade_currency: '-20000',
        }),
      ],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('pairs a dividend debited on the trade date, and never with its commission fee', () => {
    // The commission is charged separately in shekels — the NIS column — and moves the other way.
    const dividend = execution({
      trade_type: DIVIDEND,
      trade_date: '2024-03-10',
      value_date: '2024-03-12',
      net_value_trade_currency: '850.00',
      net_value_settlement_currency: '845.75',
      net_value_nis: '-15.30',
    });
    const fee = transaction({
      id: 't-fee',
      amount: '-15.30',
      currency: 'ILS',
      debit_date: '2024-03-12',
      event_date: '2024-03-12',
      source_description: "ניעז עמ' תשלום FSEC PYMNT FEE",
      source_reference: '5129523',
    });
    const income = transaction({
      id: 't-income',
      amount: '850.00',
      debit_date: '2024-03-10',
      event_date: '2024-03-12',
      source_description: 'ניע"ז תשלומים 0005129523',
    });

    expect(match([fee, income], [dividend]).get('e1')?.id).toBe('t-income');
  });

  it('pairs a cancelled dividend with the money going back out, booked back-dated', () => {
    const matched = match(
      [
        transaction({
          amount: '-430.10',
          debit_date: '2024-03-12',
          event_date: '2024-06-02',
          source_description: 'ניע"ז תשלומים 0005129523',
        }),
      ],
      [
        execution({
          trade_type: DIVIDEND,
          trade_date: '2024-03-12',
          value_date: '2024-03-12',
          net_value_trade_currency: '-430.10',
          is_cancel_transaction: CANCELLED,
        }),
      ],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });

  it('pairs a dividend and its cancellation each with the cash of its own direction', () => {
    const original = execution({
      id: 'e-original',
      trade_type: DIVIDEND,
      value_date: '2024-03-12',
      net_value_trade_currency: '430.10',
    });
    const cancellation = execution({
      id: 'e-cancellation',
      trade_type: DIVIDEND,
      value_date: '2024-03-12',
      net_value_trade_currency: '-430.10',
      is_cancel_transaction: CANCELLED,
    });

    const matched = match(
      [
        transaction({ id: 't-out', amount: '-430.10' }),
        transaction({ id: 't-in', amount: '430.10' }),
      ],
      [cancellation, original],
    );

    expect(matched.get('e-original')?.id).toBe('t-in');
    expect(matched.get('e-cancellation')?.id).toBe('t-out');
  });

  it('pairs recurring payouts of one security each with their own month', () => {
    const payout = (id: string, tradeDate: TimelessDateString, valueDate: TimelessDateString) =>
      execution({
        id,
        trade_type: DIVIDEND,
        trade_date: tradeDate,
        value_date: valueDate,
        net_value_trade_currency: '600.00',
      });
    const cash = (id: string, debitDate: TimelessDateString, eventDate: TimelessDateString) =>
      transaction({
        id,
        amount: '600.00',
        debit_date: debitDate,
        event_date: eventDate,
      });

    const matched = match(
      [cash('t-april', '2024-04-10', '2024-04-11'), cash('t-march', '2024-03-10', '2024-03-11')],
      [payout('e-march', '2024-03-10', '2024-03-11'), payout('e-april', '2024-04-10', '2024-04-11')],
    );

    expect(matched.get('e-march')?.id).toBe('t-march');
    expect(matched.get('e-april')?.id).toBe('t-april');
  });
});

describe('matchExecutionsToTransactions — the settlement window', () => {
  it('pairs cash that moved within the window after the value date', () => {
    const lastDay = addDaysToTimelessDate('2024-03-12', CASH_SETTLEMENT_WINDOW_DAYS);

    expect(match([transaction({ debit_date: lastDay })], [execution()]).get('e1')?.id).toBe('t1');
  });

  it('does not pair cash that moved past the window', () => {
    const pastWindow = addDaysToTimelessDate('2024-03-12', CASH_SETTLEMENT_WINDOW_DAYS + 1);

    expect(match([transaction({ debit_date: pastWindow })], [execution()]).size).toBe(0);
  });

  it('prefers the transaction dated exactly on the value date over a closer-by window one', () => {
    const matched = match(
      [
        transaction({ id: 't-window', debit_date: '2024-03-13' }),
        transaction({ id: 't-exact', debit_date: '2024-03-12' }),
      ],
      [execution()],
    );

    expect(matched.get('e1')?.id).toBe('t-exact');
  });

  it('pairs the same amount traded a week apart each with its nearest cash', () => {
    const matched = match(
      [
        transaction({ id: 't-second', debit_date: '2024-03-14' }),
        transaction({ id: 't-first', debit_date: '2024-03-07' }),
      ],
      [
        execution({ id: 'e-first', trade_date: '2024-03-04', value_date: '2024-03-06' }),
        execution({ id: 'e-second', trade_date: '2024-03-04', value_date: '2024-03-13' }),
      ],
    );

    expect(matched.get('e-first')?.id).toBe('t-first');
    expect(matched.get('e-second')?.id).toBe('t-second');
  });
});

describe('matchExecutionsToTransactions — the security key', () => {
  it('will not pair a transaction that names another security', () => {
    expect(
      match([transaction({ source_description: 'ניע"ז קניה 0007654321' })], [execution()]).size,
    ).toBe(0);
  });

  it('pairs a transaction that names the execution’s security', () => {
    const matched = match(
      [transaction({ source_description: 'ניע"ז קניה 0005129523' })],
      [execution()],
    );

    expect(matched.get('e1')?.id).toBe('t1');
  });
});

describe('transactionCashDates', () => {
  it('lists the debit date and the event date once each', () => {
    expect(
      transactionCashDates({
        debit_date: '2024-03-11',
        debit_date_override: null,
        event_date: '2024-03-13',
      }),
    ).toEqual(['2024-03-11', '2024-03-13']);
    expect(
      transactionCashDates({
        debit_date: '2024-03-12',
        debit_date_override: null,
        event_date: '2024-03-12',
      }),
    ).toEqual(['2024-03-12']);
  });

  it('lets a debit date override stand in for the debit date', () => {
    expect(
      transactionCashDates({
        debit_date: '2024-03-11',
        debit_date_override: '2024-03-20',
        event_date: null,
      }),
    ).toEqual(['2024-03-20']);
  });
});

describe('executionAmountInCurrency', () => {
  const amounts = (overrides: Partial<MatchableExecution> = {}) => ({
    trade_currency: ILS_LABEL,
    settlement_currency: ILS_LABEL,
    net_value_trade_currency: '0',
    net_value_settlement_currency: '0',
    net_value_nis: '-48000.50',
    ...overrides,
  });

  it('skips a column the feed left at zero for the next one in the same currency', () => {
    expect(executionAmountInCurrency(amounts(), Currency.Ils)).toBe('-48000.50');
  });

  it('reads an execution worth zero as zero', () => {
    expect(executionAmountInCurrency(amounts({ net_value_nis: '0' }), Currency.Ils)).toBe('0');
  });

  it('reads the trade-currency column first when it is reported', () => {
    expect(
      executionAmountInCurrency(
        amounts({ trade_currency: USD_LABEL, net_value_trade_currency: '850.00' }),
        Currency.Usd,
      ),
    ).toBe('850.00');
  });

  it('has nothing to compare in a currency the execution is not quoted in', () => {
    expect(executionAmountInCurrency(amounts(), Currency.Eur)).toBeNull();
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
        execution({ id: 'e-newer', trade_date: '2024-03-11' }),
        execution({ id: 'e-older', trade_date: '2024-03-09' }),
      ],
      accountTuples,
    );

    expect(matched.get('5129523')?.map(e => e.id)).toEqual(['e-older', 'e-newer']);
  });
});
