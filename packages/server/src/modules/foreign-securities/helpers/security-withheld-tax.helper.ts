import type { SecurityExecutionRow } from '../types.js';

export type WithheldTaxPartsExecution = Pick<
  SecurityExecutionRow,
  | 'foreign_tax_value_settlement_currency'
  | 'israel_tax_value_by_payments_settlement_currency'
  | 'capital_tax_value_settlement_currency'
>;

/** A numeric column read as a number: 0 when it is empty or unreadable */
export function toAmount(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * The tax withheld on an execution, split by who withheld it, in the settlement currency: the
 * foreign tax (withheld abroad, creditable against Israeli tax on the same income) and the Israeli
 * tax (withheld by the bank at source, creditable against the advance).
 *
 * The capital tax column restates the Israeli one, so it only stands in when the Israeli column is
 * empty — adding the two would count the Israeli tax twice. Both parts are signed: a refund (and a
 * cancellation) reports them negated.
 */
export function getWithheldTaxParts(execution: WithheldTaxPartsExecution): {
  foreign: number;
  israeli: number;
} {
  return {
    foreign: toAmount(execution.foreign_tax_value_settlement_currency),
    israeli:
      toAmount(execution.israel_tax_value_by_payments_settlement_currency) ||
      toAmount(execution.capital_tax_value_settlement_currency),
  };
}
