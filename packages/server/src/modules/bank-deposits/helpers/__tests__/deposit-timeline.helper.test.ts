import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  buildDepositTimeline,
  CAPITALIZED_INTEREST_ACTION,
  matchDepositTaxEvents,
  PAID_OUT_INTEREST_ACTION,
  type DepositMovement,
  type DepositTaxEventRow,
} from '../deposit-timeline.helper.js';

const d = (date: string) => date as TimelessDateString;

function movement(
  chargeId: string,
  date: string,
  amount: number,
  { isPrincipal = true, rate = 1, id }: { isPrincipal?: boolean; rate?: number; id?: string } = {},
): DepositMovement {
  return { id: id ?? `${chargeId}-${amount}`, chargeId, date: d(date), amount, rate, isPrincipal };
}

function taxRow(
  date: string,
  action: string,
  amount: number,
  { charged = 0, credited = 0 }: { charged?: number; credited?: number } = {},
): DepositTaxEventRow {
  return {
    id: `${date}-${action}-${amount}`,
    date: d(date),
    actionTypeDescription: action,
    taxEventAmount: amount,
    debitAmount: charged,
    crditAmount: credited,
  };
}

// ILS prime deposit: two top-ups, two partial withdrawals, then close. The bank realized interest on
// the whole deposit at every event; 14.56 of it was capitalized silently (no transaction), which is
// exactly what the final withdrawal over-draws by.
const ilsMovements: DepositMovement[] = [
  movement('c1', '2025-11-13', -5743.69),
  movement('c2', '2025-11-19', 14.08),
  movement('c2', '2025-11-19', 0.01, { isPrincipal: false }),
  movement('c3', '2025-12-01', -7255.97),
  movement('c4', '2025-12-03', 19.84),
  movement('c5', '2025-12-05', 12_980.3),
  movement('c5', '2025-12-05', 2.69, { isPrincipal: false }),
];

const ilsTaxRows: DepositTaxEventRow[] = [
  taxRow('2025-11-19', PAID_OUT_INTEREST_ACTION, 0.01),
  taxRow('2025-11-19', CAPITALIZED_INTEREST_ACTION, 4.43),
  taxRow('2025-12-01', CAPITALIZED_INTEREST_ACTION, 7.44),
  taxRow('2025-12-03', CAPITALIZED_INTEREST_ACTION, 2.69),
  taxRow('2025-12-05', PAID_OUT_INTEREST_ACTION, 2.69),
];

function capitalizedByCharge(timeline: ReturnType<typeof buildDepositTimeline>) {
  return Object.fromEntries(
    timeline.steps.map(step => [step.chargeId, Math.round(step.capitalizedInterest * 100) / 100]),
  );
}

describe('buildDepositTimeline', () => {
  it('books the bank-reported capitalized interest and closes the deposit at zero', () => {
    const { byDeposit, unmatched } = matchDepositTaxEvents(ilsTaxRows, [
      { depositId: 'dep', movements: ilsMovements },
    ]);
    expect(unmatched).toEqual([]);

    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements: ilsMovements,
      bankFigures: byDeposit.get('dep'),
      isClosed: true,
    });

    expect(capitalizedByCharge(timeline)).toEqual({ c1: 0, c2: 4.43, c3: 7.44, c4: 2.69, c5: 0 });
    expect(timeline.steps.every(s => s.warnings.length === 0)).toBe(true);
    expect(timeline.finalPrincipal).toBeCloseTo(0, 6);
    expect(timeline.finalLocal).toBeCloseTo(0, 6);
    expect(timeline.totalInterest).toBeCloseTo(17.26, 6);
    expect(timeline.steps[1].source).toBe('BANK');
    expect(timeline.warnings).toEqual([]);
  });

  it('infers the residual by accrual weight when the bank figures are missing', () => {
    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements: ilsMovements,
      isClosed: true,
    });

    expect(capitalizedByCharge(timeline)).toEqual({ c1: 0, c2: 3.88, c3: 7.75, c4: 2.93, c5: 0 });
    expect(timeline.steps[1].source).toBe('INFERRED');
    expect(timeline.finalPrincipal).toBeCloseTo(0, 6);
    expect(timeline.warnings).toHaveLength(1);
  });

  it('infers nothing for an open deposit that is not over-withdrawn', () => {
    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements: ilsMovements.filter(m => m.chargeId !== 'c5'),
      isClosed: false,
    });
    expect(timeline.steps.every(s => s.capitalizedInterest === 0)).toBe(true);
    expect(timeline.finalPrincipal).toBeCloseTo(12_965.74, 6);
  });

  it('skips locked events when inferring', () => {
    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements: ilsMovements,
      isClosed: true,
      ledgerLock: d('2025-11-30'),
    });
    const capitalized = capitalizedByCharge(timeline);
    expect(capitalized.c2).toBe(0);
    expect(capitalized.c3 + capitalized.c4).toBeCloseTo(14.56, 6);
  });

  it('books tax withheld inside the deposit and on the paid-out interest', () => {
    const rows = [
      taxRow('2025-11-19', CAPITALIZED_INTEREST_ACTION, 5.9, { charged: 1.47 }),
      taxRow('2025-11-19', PAID_OUT_INTEREST_ACTION, 0.02, { charged: 0.01 }),
    ];
    const movements = [
      movement('c1', '2025-11-13', -5743.69),
      movement('c2', '2025-11-19', 14.08),
      movement('c2', '2025-11-19', 0.01, { isPrincipal: false }),
    ];
    const { byDeposit } = matchDepositTaxEvents(rows, [{ depositId: 'dep', movements }]);
    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements,
      bankFigures: byDeposit.get('dep'),
      isClosed: false,
    });
    const step = timeline.steps[1];
    expect(step.capitalizedInterest).toBeCloseTo(5.9, 6);
    expect(step.taxCapitalized).toBeCloseTo(1.47, 6);
    expect(step.taxPaidOut).toBeCloseTo(0.01, 6);
    expect(step.warnings).toEqual([]);
    expect(step.pAfter).toBeCloseTo(5743.69 + 5.9 - 1.47 - 14.08, 6);
  });

  it('warns when the paid-out interest does not match the charge interest lines', () => {
    const movements = [
      movement('c1', '2025-11-13', -1000),
      movement('c2', '2025-11-19', 100),
      movement('c2', '2025-11-19', 0.5, { isPrincipal: false }),
    ];
    const { byDeposit } = matchDepositTaxEvents(
      [taxRow('2025-11-19', PAID_OUT_INTEREST_ACTION, 0.9)],
      [{ depositId: 'dep', movements }],
    );
    const timeline = buildDepositTimeline({
      currency: 'ILS',
      localCurrency: 'ILS',
      movements,
      bankFigures: byDeposit.get('dep'),
      isClosed: false,
    });
    expect(timeline.steps[1].warnings).toHaveLength(1);
  });

  describe('foreign currency', () => {
    // deposit 1000 at 3.5, withdraw 300 at 3.7, top up 500 at 3.6, close (1200) at 3.8
    const usd = [
      movement('u1', '2025-01-10', -1000, { rate: 3.5 }),
      movement('u2', '2025-03-10', 300, { rate: 3.7 }),
      movement('u3', '2025-06-10', -500, { rate: 3.6 }),
      movement('u4', '2025-09-10', 1200, { rate: 3.8 }),
    ];

    it('revalues the carried principal at every event without double-counting', () => {
      const timeline = buildDepositTimeline({
        currency: 'USD',
        localCurrency: 'ILS',
        movements: usd,
        isClosed: true,
      });
      const revaluations = timeline.steps.map(s => Math.round(s.revaluation * 100) / 100);
      expect(revaluations).toEqual([0, 200, -70, 240]);
      // total FX gain = local out − local in
      const localIn = 1000 * 3.5 + 500 * 3.6;
      const localOut = 300 * 3.7 + 1200 * 3.8;
      expect(revaluations.reduce((a, b) => a + b, 0)).toBeCloseTo(localOut - localIn, 6);
      expect(timeline.finalLocal).toBeCloseTo(0, 6);
    });

    it('resets the basis at a booked year-end checkpoint', () => {
      const movements = [
        movement('u1', '2024-11-10', -1000, { rate: 3.5 }),
        movement('u2', '2025-02-10', 1000, { rate: 3.8 }),
      ];
      const timeline = buildDepositTimeline({
        currency: 'USD',
        localCurrency: 'ILS',
        movements,
        yearEnds: [{ date: d('2024-12-31'), rate: 3.6 }],
        isClosed: true,
      });
      expect(timeline.yearEnds).toHaveLength(1);
      expect(timeline.yearEnds[0].revaluation).toBeCloseTo(100, 6);
      expect(timeline.steps[1].revaluation).toBeCloseTo(200, 6);
    });

    it('reports a year-end checkpoint for a deposit still open', () => {
      const timeline = buildDepositTimeline({
        currency: 'USD',
        localCurrency: 'ILS',
        movements: [movement('u1', '2025-11-10', -1000, { rate: 3.5 })],
        yearEnds: [{ date: d('2025-12-31'), rate: 3.4 }],
        isClosed: false,
      });
      expect(timeline.yearEnds[0].revaluation).toBeCloseTo(-100, 6);
    });

    it('infers capitalized interest in the deposit currency', () => {
      const movements = [
        movement('u1', '2025-01-10', -1000, { rate: 3.5 }),
        movement('u2', '2025-03-10', 300, { rate: 3.7 }),
        movement('u3', '2025-06-10', 710, { rate: 3.8 }),
      ];
      const timeline = buildDepositTimeline({
        currency: 'USD',
        localCurrency: 'ILS',
        movements,
        isClosed: true,
      });
      expect(timeline.steps[1].capitalizedInterest).toBeCloseTo(10, 6);
      expect(timeline.steps[1].capitalizedInterestLocal).toBeCloseTo(37, 6);
      expect(timeline.finalPrincipal).toBeCloseTo(0, 6);
      expect(timeline.finalLocal).toBeCloseTo(0, 6);
    });
  });
});

describe('matchDepositTaxEvents', () => {
  it('leaves rows with no deposit event that day unmatched', () => {
    const { unmatched } = matchDepositTaxEvents(
      [taxRow('2025-10-03', CAPITALIZED_INTEREST_ACTION, 10.57)],
      [{ depositId: 'dep', movements: ilsMovements }],
    );
    expect(unmatched).toHaveLength(1);
  });

  it('splits a capitalized row between deposits with an event on the same day', () => {
    const a = [movement('a1', '2025-01-01', -3000), movement('a2', '2025-02-01', 100)];
    const b = [movement('b1', '2025-01-01', -1000), movement('b2', '2025-02-01', 50)];
    const { byDeposit } = matchDepositTaxEvents(
      [taxRow('2025-02-01', CAPITALIZED_INTEREST_ACTION, 8)],
      [
        { depositId: 'a', movements: a },
        { depositId: 'b', movements: b },
      ],
    );
    const figuresA = byDeposit.get('a')?.get(d('2025-02-01'));
    const figuresB = byDeposit.get('b')?.get(d('2025-02-01'));
    expect(figuresA?.capitalizedInterest).toBeCloseTo(6, 6);
    expect(figuresB?.capitalizedInterest).toBeCloseTo(2, 6);
    expect(figuresA?.allocated).toBe(true);
  });

  it('assigns a paid-out row to the deposit whose interest line fits it', () => {
    const a = [
      movement('a1', '2025-01-01', -3000),
      movement('a2', '2025-02-01', 100),
      movement('a2', '2025-02-01', 0.4, { isPrincipal: false }),
    ];
    const b = [
      movement('b1', '2025-01-01', -1000),
      movement('b2', '2025-02-01', 50),
      movement('b2', '2025-02-01', 0.07, { isPrincipal: false }),
    ];
    const { byDeposit } = matchDepositTaxEvents(
      [taxRow('2025-02-01', PAID_OUT_INTEREST_ACTION, 0.07)],
      [
        { depositId: 'a', movements: a },
        { depositId: 'b', movements: b },
      ],
    );
    expect(byDeposit.get('b')?.get(d('2025-02-01'))?.paidOutInterest).toBeCloseTo(0.07, 6);
    expect(byDeposit.get('a')).toBeUndefined();
  });
});
