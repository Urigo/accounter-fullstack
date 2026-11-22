import type { TimelessDateString } from '../../../shared/types/index.js';

/**
 * Bank deposits timeline: the per-event accounting of a deposit.
 *
 * On every principal event of a deposit (a top-up or a withdrawal) the bank realizes the interest
 * accrued on the WHOLE deposit since the previous event, as if it sold the deposit and re-deposited
 * it: the share of the withdrawn amount is paid out (a visible interest transaction), the rest is
 * capitalized silently into the deposit, and tax is charged / credited on it. For foreign-currency
 * deposits the deposit is also revalued at the event's rate.
 *
 * Without booking the capitalized interest, the deposit account ends "over-withdrawn". This module
 * replays a deposit's movements with that model:
 *
 * - P: carried principal, in the deposit currency (positive = held in the deposit)
 * - L: P's local book value
 *
 * Per event, in order: FX revaluation of P to the event rate, capitalized interest C (+ tax
 * withheld inside the deposit), then the principal flow itself.
 *
 * C and the tax come from the bank's deposits tax-collection report when available
 * ("תשלום ריבית ל" rows); otherwise, once a deposit is closed (or over-withdrawn), the unexplained
 * residual is inferred and spread over the events by accrual weight.
 *
 * Pure: no DI, no I/O. Rates and bank rows are resolved by `DepositTimelineProvider`.
 */

/** Interest realized on a deposit event and capitalized into the deposit */
export const CAPITALIZED_INTEREST_ACTION = 'תשלום ריבית ל';
/** Interest realized on a deposit event and paid out with the withdrawal */
export const PAID_OUT_INTEREST_ACTION = 'משיכה';

const EPSILON = 0.005;

export type DepositMovement = {
  id: string;
  chargeId: string;
  /** Value date */
  date: TimelessDateString;
  /** Event date, also accepted when matching bank rows */
  altDate?: TimelessDateString | null;
  /** Bank-account point of view, in the deposit currency: negative = moved into the deposit */
  amount: number;
  /** Local currency per deposit-currency unit at the movement's exchange date (1 for local) */
  rate: number;
  /** false for interest (or other non-principal) lines of the charge */
  isPrincipal: boolean;
};

export type DepositTaxEventRow = {
  id: string;
  date: TimelessDateString;
  actionTypeDescription: string;
  /** Taxable amount (gross interest), local currency */
  taxEventAmount: number;
  /** Tax charged, local currency */
  debitAmount: number;
  /** Tax credited, local currency (bank's spelling) */
  crditAmount: number;
};

/** The bank's figures for one deposit event, all in local currency */
export type DepositEventBankFigures = {
  capitalizedInterest: number;
  paidOutInterest: number;
  /** Net tax (charged − credited) on the capitalized interest, withheld inside the deposit */
  taxCapitalized: number;
  /** Net tax (charged − credited) on the paid-out interest, withheld from the visible line */
  taxPaidOut: number;
  rowIds: string[];
  /** Split among several deposits with an event on the same day */
  allocated: boolean;
};

export type DepositTimelineSource = 'BANK' | 'BANK_ALLOCATED' | 'INFERRED';

export type DepositTimelineStep = {
  chargeId: string;
  date: TimelessDateString;
  rate: number;
  /** In the deposit currency, positive = into the deposit */
  principalFlow: number;
  /** Visible non-principal lines (interest received), deposit currency, positive = received */
  visibleInterest: number;
  pBefore: number;
  lBefore: number;
  /** FX revaluation of the carried principal, local currency (positive = deposit value up) */
  revaluation: number;
  /** Capitalized interest, deposit currency */
  capitalizedInterest: number;
  /** Capitalized interest, local currency */
  capitalizedInterestLocal: number;
  /** Tax withheld inside the deposit, local currency */
  taxCapitalized: number;
  /** Tax withheld from the paid-out interest, local currency */
  taxPaidOut: number;
  source: DepositTimelineSource | null;
  pAfter: number;
  lAfter: number;
  warnings: string[];
};

export type DepositYearEndStep = {
  date: TimelessDateString;
  rate: number;
  pBefore: number;
  lBefore: number;
  /** Local currency, positive = deposit value up */
  revaluation: number;
};

export type DepositTimeline = {
  steps: DepositTimelineStep[];
  yearEnds: DepositYearEndStep[];
  /** Deposit currency */
  finalPrincipal: number;
  finalLocal: number;
  /** Visible + capitalized interest, deposit currency */
  totalInterest: number;
  warnings: string[];
};

export type DepositTimelineInput = {
  currency: string;
  localCurrency: string;
  movements: DepositMovement[];
  /** Bank figures keyed by event date */
  bankFigures?: Map<TimelessDateString, DepositEventBankFigures>;
  /** Booked year-end revaluation checkpoints (31/12 with that day's rate) */
  yearEnds?: Array<{ date: TimelessDateString; rate: number }>;
  ledgerLock?: TimelessDateString | null;
  isClosed: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function daysBetween(from: TimelessDateString, to: TimelessDateString): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

type DepositEvent = {
  chargeId: string;
  date: TimelessDateString;
  altDates: Set<TimelessDateString>;
  rate: number;
  principalFlow: number;
  visibleInterest: number;
};

/** Groups movements into one event per charge, ordered by date (then charge id) */
function toEvents(movements: readonly DepositMovement[]): DepositEvent[] {
  const byCharge = new Map<string, DepositMovement[]>();
  for (const movement of movements) {
    const list = byCharge.get(movement.chargeId) ?? [];
    list.push(movement);
    byCharge.set(movement.chargeId, list);
  }

  const events: DepositEvent[] = [];
  for (const [chargeId, chargeMovements] of byCharge) {
    const principal = chargeMovements.filter(m => m.isPrincipal);
    const anchor = (principal.length ? principal : chargeMovements).reduce((earliest, m) =>
      m.date < earliest.date ? m : earliest,
    );
    const altDates = new Set<TimelessDateString>();
    for (const m of principal.length ? principal : chargeMovements) {
      altDates.add(m.date);
      if (m.altDate) altDates.add(m.altDate);
    }
    events.push({
      chargeId,
      date: anchor.date,
      altDates,
      rate: anchor.rate,
      principalFlow: principal.reduce((sum, m) => sum - m.amount, 0),
      visibleInterest: chargeMovements
        .filter(m => !m.isPrincipal)
        .reduce((sum, m) => sum + m.amount, 0),
    });
  }

  return events.sort((a, b) =>
    a.date === b.date ? a.chargeId.localeCompare(b.chargeId) : a.date < b.date ? -1 : 1,
  );
}

/**
 * Matches the bank's tax-collection rows of ONE bank account to the deposits held in it.
 *
 * Rows carry no deposit id. A row belongs to the deposit with a principal event on the row's date.
 * When several deposits have an event that day, a paid-out ("משיכה") row goes to the deposit whose
 * visible interest that day fits it best, and a capitalized row is split by each deposit's principal
 * before the event (flagged as allocated). Rows with no deposit event that day are unmatched —
 * usually a deposit charge not yet assigned to its deposit.
 */
export function matchDepositTaxEvents(
  rows: readonly DepositTaxEventRow[],
  deposits: ReadonlyArray<{ depositId: string; movements: readonly DepositMovement[] }>,
): {
  byDeposit: Map<string, Map<TimelessDateString, DepositEventBankFigures>>;
  unmatched: DepositTaxEventRow[];
} {
  const depositEvents = deposits.map(d => ({
    depositId: d.depositId,
    events: toEvents(d.movements),
  }));
  const byDeposit = new Map<string, Map<TimelessDateString, DepositEventBankFigures>>();
  const unmatched: DepositTaxEventRow[] = [];

  const figuresFor = (depositId: string, date: TimelessDateString) => {
    const depositMap =
      byDeposit.get(depositId) ?? new Map<TimelessDateString, DepositEventBankFigures>();
    byDeposit.set(depositId, depositMap);
    const existing = depositMap.get(date);
    if (existing) return existing;
    const created: DepositEventBankFigures = {
      capitalizedInterest: 0,
      paidOutInterest: 0,
      taxCapitalized: 0,
      taxPaidOut: 0,
      rowIds: [],
      allocated: false,
    };
    depositMap.set(date, created);
    return created;
  };

  for (const row of rows) {
    const candidates = depositEvents
      .map(d => ({
        depositId: d.depositId,
        event: d.events.find(e => e.altDates.has(row.date)),
        principalBefore: d.events
          .filter(e => e.date < row.date)
          .reduce((sum, e) => sum + e.principalFlow, 0),
      }))
      .filter(
        (c): c is { depositId: string; event: DepositEvent; principalBefore: number } => !!c.event,
      );

    if (candidates.length === 0) {
      unmatched.push(row);
      continue;
    }

    const tax = row.debitAmount - row.crditAmount;
    const isPaidOut = row.actionTypeDescription === PAID_OUT_INTEREST_ACTION;

    if (candidates.length === 1 || isPaidOut) {
      const target =
        candidates.length === 1
          ? candidates[0]
          : candidates.reduce((best, c) =>
              Math.abs(c.event.visibleInterest + tax - row.taxEventAmount) <
              Math.abs(best.event.visibleInterest + tax - row.taxEventAmount)
                ? c
                : best,
            );
      const figures = figuresFor(target.depositId, target.event.date);
      figures.rowIds.push(row.id);
      if (isPaidOut) {
        figures.paidOutInterest += row.taxEventAmount;
        figures.taxPaidOut += tax;
      } else {
        figures.capitalizedInterest += row.taxEventAmount;
        figures.taxCapitalized += tax;
      }
      continue;
    }

    // capitalized (or unknown) row shared by several deposits: split by principal before the event
    const weights = candidates.map(c => Math.max(0, c.principalBefore));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let allocatedAmount = 0;
    let allocatedTax = 0;
    for (const [index, c] of candidates.entries()) {
      const isLast = index === candidates.length - 1;
      const share = weightSum > 0 ? weights[index] / weightSum : 1 / candidates.length;
      const amount = isLast
        ? round2(row.taxEventAmount - allocatedAmount)
        : round2(row.taxEventAmount * share);
      const taxShare = isLast ? round2(tax - allocatedTax) : round2(tax * share);
      allocatedAmount += amount;
      allocatedTax += taxShare;
      const figures = figuresFor(c.depositId, c.event.date);
      figures.rowIds.push(row.id);
      figures.capitalizedInterest += amount;
      figures.taxCapitalized += taxShare;
      figures.allocated = true;
    }
  }

  return { byDeposit, unmatched };
}

/** Replays a deposit's events under the bank's per-event realization model */
export function buildDepositTimeline(input: DepositTimelineInput): DepositTimeline {
  const { currency, localCurrency, bankFigures, ledgerLock, isClosed } = input;
  const isLocal = currency === localCurrency;
  const events = toEvents(input.movements);
  const yearEnds = [...(input.yearEnds ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));

  const simulate = (overrides: Map<string, number>) => {
    let p = 0;
    let l = 0;
    let previousDate: TimelessDateString | null = null;
    let yearEndIndex = 0;
    const consumedDates = new Set<TimelessDateString>();
    const steps: DepositTimelineStep[] = [];
    const yearEndSteps: DepositYearEndStep[] = [];

    const applyYearEnd = (checkpoint: { date: TimelessDateString; rate: number }) => {
      const revaluation = isLocal ? 0 : p * checkpoint.rate - l;
      yearEndSteps.push({
        date: checkpoint.date,
        rate: checkpoint.rate,
        pBefore: p,
        lBefore: l,
        revaluation,
      });
      l += revaluation;
    };

    for (const event of events) {
      while (yearEndIndex < yearEnds.length && yearEnds[yearEndIndex].date < event.date) {
        if (previousDate !== null && yearEnds[yearEndIndex].date >= previousDate) {
          applyYearEnd(yearEnds[yearEndIndex]);
        }
        yearEndIndex++;
      }

      const warnings: string[] = [];
      const pBefore = p;
      const lBefore = l;

      const revaluation = isLocal ? 0 : p * event.rate - l;
      l += revaluation;

      const figures = consumedDates.has(event.date) ? undefined : bankFigures?.get(event.date);
      if (figures) consumedDates.add(event.date);

      const override = overrides.get(event.chargeId);
      let capitalizedInterest = 0;
      let source: DepositTimelineSource | null = null;
      if (override !== undefined) {
        capitalizedInterest = override;
        source = 'INFERRED';
      } else if (figures && isLocal) {
        capitalizedInterest = figures.capitalizedInterest;
        source = figures.allocated ? 'BANK_ALLOCATED' : 'BANK';
      } else if (figures) {
        source = figures.allocated ? 'BANK_ALLOCATED' : 'BANK';
      }
      const capitalizedInterestLocal = capitalizedInterest * event.rate;
      p += capitalizedInterest;
      l += capitalizedInterestLocal;

      const taxCapitalized = figures?.taxCapitalized ?? 0;
      const taxPaidOut = figures?.taxPaidOut ?? 0;
      if (taxCapitalized) {
        p -= taxCapitalized / event.rate;
        l -= taxCapitalized;
      }

      p += event.principalFlow;
      l += event.principalFlow * event.rate;

      if (
        figures &&
        isLocal &&
        Math.abs(event.visibleInterest + taxPaidOut - figures.paidOutInterest) > 0.011
      ) {
        warnings.push(
          `Bank reports ${round2(figures.paidOutInterest)} interest paid out on ${event.date}, but the charge's interest lines (+ tax) sum to ${round2(event.visibleInterest + taxPaidOut)}`,
        );
      }

      steps.push({
        chargeId: event.chargeId,
        date: event.date,
        rate: event.rate,
        principalFlow: event.principalFlow,
        visibleInterest: event.visibleInterest,
        pBefore,
        lBefore,
        revaluation,
        capitalizedInterest,
        capitalizedInterestLocal,
        taxCapitalized,
        taxPaidOut,
        source,
        pAfter: p,
        lAfter: l,
        warnings,
      });
      previousDate = event.date;
    }

    // checkpoints after the last event, while principal is still held
    while (yearEndIndex < yearEnds.length) {
      if (
        previousDate !== null &&
        yearEnds[yearEndIndex].date >= previousDate &&
        Math.abs(p) > EPSILON
      ) {
        applyYearEnd(yearEnds[yearEndIndex]);
      }
      yearEndIndex++;
    }

    return { steps, yearEndSteps, p, l };
  };

  const warnings: string[] = [];
  let result = simulate(new Map());

  // Inference: once closed (or over-withdrawn), whatever principal is left unexplained is
  // interest the bank capitalized without our having its figures.
  const residual = -result.p;
  if (Math.abs(residual) > EPSILON && (isClosed || result.p < -EPSILON) && events.length > 0) {
    const hasBankCapitalized = (step: DepositTimelineStep) =>
      isLocal && step.source !== null && step.source !== 'INFERRED';
    const unlocked = (step: DepositTimelineStep) => !ledgerLock || step.date > ledgerLock;

    let candidates = result.steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step, index }) =>
          index > 0 &&
          index < result.steps.length - 1 &&
          !hasBankCapitalized(step) &&
          unlocked(step),
      );
    if (candidates.length === 0) {
      const last = result.steps.at(-1)!;
      candidates = unlocked(last) ? [{ step: last, index: result.steps.length - 1 }] : [];
    }

    if (candidates.length === 0) {
      warnings.push(
        `Deposit closes with ${round2(residual)} ${currency} unexplained principal, but every event is locked`,
      );
    } else {
      const weights = candidates.map(({ step, index }) => {
        const previous = result.steps[index - 1];
        const days = previous ? Math.max(0, daysBetween(previous.date, step.date)) : 0;
        return Math.max(0, step.pBefore) * days;
      });
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const overrides = new Map<string, number>();
      let allocated = 0;
      for (const [i, { step }] of candidates.entries()) {
        const isLast = i === candidates.length - 1;
        const share = weightSum > 0 ? weights[i] / weightSum : 1 / candidates.length;
        const amount = isLast ? round2(residual - allocated) : round2(residual * share);
        allocated += amount;
        overrides.set(step.chargeId, amount);
      }
      result = simulate(overrides);
      warnings.push(
        `${round2(residual)} ${currency} of capitalized interest was inferred (no bank figures for those events)`,
      );
    }
  }

  const totalInterest = result.steps.reduce(
    (sum, step) => sum + step.visibleInterest + step.capitalizedInterest,
    0,
  );

  return {
    steps: result.steps,
    yearEnds: result.yearEndSteps,
    finalPrincipal: result.p,
    finalLocal: result.l,
    totalInterest,
    warnings,
  };
}
