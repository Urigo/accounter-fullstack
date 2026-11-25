import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '@/helpers/dates.js';
import { Currency, type DepositTransactionFieldsFragment } from '../../../gql/graphql.js';
import {
  buildDepositTableRows,
  type DepositTableTimelineStep,
  type DepositTableYearEnd,
} from '../utils.js';

function tx(
  id: string,
  chargeId: string,
  eventDate: TimelessDateString,
  amount: number,
  currency: Currency,
  usdRate?: number,
): DepositTransactionFieldsFragment {
  const rates =
    usdRate === undefined
      ? null
      : {
          aud: null,
          cad: null,
          eur: null,
          gbp: null,
          jpy: null,
          sek: null,
          usd: usdRate,
          date: eventDate,
        };
  return {
    id,
    chargeId,
    eventDate,
    amount: { raw: amount, formatted: String(amount), currency },
    debitExchangeRates: rates,
    eventExchangeRates: null,
  };
}

function step(
  chargeId: string,
  date: TimelessDateString,
  figures: Partial<{
    rate: number;
    revaluation: number;
    capitalizedInterest: number;
    capitalizedInterestLocal: number;
    taxCapitalized: number;
    taxPaidOut: number;
  }> = {},
): DepositTableTimelineStep {
  const rate = figures.rate ?? 1;
  const capitalizedInterest = figures.capitalizedInterest ?? 0;
  return {
    id: `deposit:${chargeId}`,
    chargeId,
    date,
    rate,
    source: capitalizedInterest ? 'BANK' : null,
    revaluation: { raw: figures.revaluation ?? 0 },
    capitalizedInterest: { raw: capitalizedInterest },
    capitalizedInterestLocal: {
      raw: figures.capitalizedInterestLocal ?? capitalizedInterest * rate,
    },
    taxCapitalized: { raw: figures.taxCapitalized ?? 0 },
    taxPaidOut: { raw: figures.taxPaidOut ?? 0 },
  };
}

const last = <T>(rows: T[]): T => rows[rows.length - 1];

describe('buildDepositTableRows', () => {
  it('closes a local deposit with capitalized interest and tax at 0 in both balances', () => {
    const rows = buildDepositTableRows({
      transactions: [
        tx('t1', 'open', '2025-01-01', -1000, Currency.Ils),
        tx('t2', 'close', '2025-07-01', 1037.5, Currency.Ils),
      ],
      timeline: {
        steps: [
          step('open', '2025-01-01'),
          step('close', '2025-07-01', { capitalizedInterest: 50, taxCapitalized: 12.5 }),
        ],
        yearEnds: [],
      },
      depositCurrency: Currency.Ils,
      localCurrency: Currency.Ils,
    });

    expect(rows.map(r => r.kind)).toEqual([
      'transaction',
      'capitalizedInterest',
      'tax',
      'transaction',
    ]);
    expect(rows.map(r => r.cumulativeBalance)).toEqual([-1000, -1050, -1037.5, 0]);
    expect(rows.map(r => r.localCumulativeBalance)).toEqual([-1000, -1050, -1037.5, 0]);
    expect(last(rows).totalInterest).toBe(50);

    const [, interest, tax] = rows;
    expect(interest.amount).toEqual({ raw: -50, formatted: '₪ -50.00', currency: Currency.Ils });
    expect(tax.amount).toEqual({ raw: 12.5, formatted: '₪ 12.50', currency: Currency.Ils });
  });

  it('closes a USD deposit spanning a booked year end at 0 in both balances', () => {
    const yearEnds: DepositTableYearEnd[] = [
      { id: 'deposit:year-end:2024-12-31', date: '2024-12-31', revaluation: { raw: 100 } },
    ];
    const rows = buildDepositTableRows({
      transactions: [
        tx('t1', 'open', '2024-06-01', -1000, Currency.Usd, 3.5),
        tx('t2', 'close', '2025-03-01', 1010, Currency.Usd, 3.7),
      ],
      timeline: {
        steps: [
          step('open', '2024-06-01', { rate: 3.5 }),
          // 1000 × 3.7 − (3500 + 100 year-end revaluation)
          step('close', '2025-03-01', {
            rate: 3.7,
            revaluation: 100,
            capitalizedInterest: 20,
            taxCapitalized: 37,
          }),
        ],
        yearEnds,
      },
      depositCurrency: Currency.Usd,
      localCurrency: Currency.Ils,
    });

    expect(rows.map(r => r.id)).toEqual([
      't1',
      'deposit:year-end:2024-12-31',
      'deposit:close:revaluation',
      'deposit:close:interest',
      'deposit:close:tax',
      't2',
    ]);
    expect(last(rows).cumulativeBalance).toBeCloseTo(0, 6);
    expect(last(rows).localCumulativeBalance).toBeCloseTo(0, 6);
    // the year end moves the local balance only
    expect(rows[1].cumulativeBalance).toBe(-1000);
    expect(rows[1].localCumulativeBalance).toBeCloseTo(-3600, 6);
    // tax withheld inside the deposit takes its principal at the event's rate
    expect(rows[4].cumulativeBalance).toBeCloseTo(-1010, 6);

    // realized rows are in the deposit currency; tax and revaluation have no origin amount
    for (const row of rows.slice(1, 5)) {
      expect(row.amount.currency).toBe(Currency.Usd);
    }
    expect(rows[1].amount.formatted).toBe('—');
    expect(rows[2].amount.formatted).toBe('—');
    expect(rows[4].amount.formatted).toBe('—');
    expect(rows[3].amount.raw).toBe(-20);
  });

  it("keeps an event's realized rows with its transactions, by the earliest event date", () => {
    const rows = buildDepositTableRows({
      transactions: [
        tx('t1', 'open', '2025-01-01', -1000, Currency.Ils),
        // event date 03-01, value date (step date) 03-05
        tx('t2', 'top-up', '2025-03-01', -500, Currency.Ils),
        tx('t3', 'close', '2025-03-03', 1530, Currency.Ils),
      ],
      timeline: {
        steps: [
          step('open', '2025-01-01'),
          step('top-up', '2025-03-05', { capitalizedInterest: 30 }),
          step('close', '2025-03-03'),
        ],
        yearEnds: [],
      },
      depositCurrency: Currency.Ils,
      localCurrency: Currency.Ils,
    });

    expect(rows.map(r => r.id)).toEqual(['t1', 'deposit:top-up:interest', 't2', 't3']);
    expect(rows[1].eventDate).toBe('2025-03-01');
    expect(rows.map(r => r.cumulativeBalance)).toEqual([-1000, -1030, -1530, 0]);
  });

  it('shows the transactions alone when the timeline is missing', () => {
    const rows = buildDepositTableRows({
      transactions: [tx('t1', 'open', '2025-01-01', -1000, Currency.Ils)],
      timeline: null,
      depositCurrency: null,
      localCurrency: Currency.Ils,
    });
    expect(rows.map(r => [r.id, r.cumulativeBalance])).toEqual([['t1', -1000]]);
  });
});
