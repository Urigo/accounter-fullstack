/** Derived main-form codes (SPEC §7.4). */
import type { Declarations } from '../model/input.js';

/**
 * Code 273 from the declarations 1029/1030 (p.19): yes/no → 1, no/yes → 2, yes/yes → 3,
 * no/no → 9.
 */
export function deriveCode273(
  declarations: Pick<Declarations, 'directorsReceivedOpinion' | 'tookReportablePosition'>,
): 1 | 2 | 3 | 9 {
  const { directorsReceivedOpinion, tookReportablePosition } = declarations;
  if (directorsReceivedOpinion && tookReportablePosition) {
    return 3;
  }
  if (directorsReceivedOpinion) {
    return 1;
  }
  return tookReportablePosition ? 2 : 9;
}

/** Code 008: 1 when the company applies accounting standards (882 = yes, p.9), else omitted. */
export function deriveCode008(
  declarations: Pick<Declarations, 'appliesAccountingStandards'>,
): 1 | undefined {
  return declarations.appliesAccountingStandards ? 1 : undefined;
}

/**
 * 1000@833, has a capital-gains appendix: yes when `hasCapitalGainsAppendix` is true. The input
 * model has no capital-gains appendices or untransmitted count yet (steps D2, G1), so it is
 * otherwise no.
 */
export function deriveHasCapitalGainsAppendix(
  declarations: Pick<Declarations, 'hasCapitalGainsAppendix'>,
): boolean {
  return declarations.hasCapitalGainsAppendix === true;
}
