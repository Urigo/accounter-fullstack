/** Derived main-form codes (SPEC §7.4). */
import type { DerivedMainCode } from '../model/codes.generated.js';
import type { Declarations, Report1214Input } from '../model/input.js';

/**
 * The input properties each derived main-form code comes from (SPEC §7.4); input.derivedCode names
 * them when a caller passes the code in `amounts`.
 */
export const DERIVED_MAIN_CODE_SOURCES: Readonly<Record<DerivedMainCode, readonly string[]>> = {
  '008': ['declarations.appliesAccountingStandards'],
  '028': ['capitalGains', 'capitalGainsSummary.untransmittedCount'],
  '273': ['declarations.directorsReceivedOpinion', 'declarations.tookReportablePosition'],
  '277': ['bankAccount'],
  '278': ['bankAccount'],
  '280': ['bankAccount'],
  '297': ['declarations.form6111Obligation'],
};

/** Code 297 by `form6111Obligation` (p.7: 834 → "fill 297 with 8/9"); `notRelevant` has none. */
export const CODE_297_VALUES = {
  obliged: 8,
  notObliged: 9,
} as const satisfies Partial<Record<NonNullable<Declarations['form6111Obligation']>, number>>;

/** Code 297 from 834 (SPEC §7.4): obliged → 8, notObliged → 9, otherwise omitted. */
export function deriveCode297(
  declarations: Pick<Declarations, 'form6111Obligation'>,
): 8 | 9 | undefined {
  switch (declarations.form6111Obligation) {
    case 'obliged':
    case 'notObliged':
      return CODE_297_VALUES[declarations.form6111Obligation];
    default:
      return undefined;
  }
}

/** A bank account of the input (SPEC §7.2). */
export type BankAccount = NonNullable<Report1214Input['bankAccount']>;

/** Number of digits of an account: 277 holds up to 9 digits, zero-padded on the left (p.19). */
export const BANK_ACCOUNT_DIGITS = 9;

/** The format of each bankAccount member (main.bankAccount.format, p.19). */
export const BANK_ACCOUNT_FORMAT: Readonly<
  Record<keyof BankAccount, { pattern: RegExp; expected: string }>
> = {
  bank: { pattern: /^\d{2}$/, expected: 'exactly 2 digits' },
  branch: { pattern: /^\d{3}$/, expected: 'exactly 3 digits' },
  account: { pattern: /^\d{1,9}$/, expected: '1 to 9 digits' },
};

/** The members of `bankAccount` that do not have their format (main.bankAccount.format). */
export function malformedBankAccountMembers(bankAccount: BankAccount): Array<keyof BankAccount> {
  return (['bank', 'branch', 'account'] as const).filter(
    member => !BANK_ACCOUNT_FORMAT[member].pattern.test(bankAccount[member]),
  );
}

/**
 * Codes 277/278/280 from a well-formed `bankAccount` (SPEC §7.4, p.19–20): 277 = account,
 * 278 = bank (2 digits) then branch (3 digits), 280 = 1.
 */
export function deriveBankCodes(bankAccount: BankAccount): { 277: number; 278: number; 280: 1 } {
  return {
    277: Number(bankAccount.account),
    278: Number(bankAccount.bank + bankAccount.branch),
    280: 1,
  };
}

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
 * Code 028, the number of capital-gains forms attached, transmitted and not (SPEC §7.4, p.14): the
 * capital-gains appendices plus `capitalGainsSummary.untransmittedCount`, omitted when 0.
 */
export function deriveCode028(
  input: Pick<Report1214Input, 'capitalGains' | 'capitalGainsSummary'>,
): number | undefined {
  const untransmitted = hasUntransmittedAppendices(input.capitalGainsSummary)
    ? (input.capitalGainsSummary?.untransmittedCount ?? 0)
    : 0;
  const count = (input.capitalGains?.length ?? 0) + untransmitted;
  return count > 0 ? count : undefined;
}

/** Whether `capitalGainsSummary.untransmittedCount` is greater than 0 (→ 833 = yes, SPEC §7.4). */
export function hasUntransmittedAppendices(
  summary: Report1214Input['capitalGainsSummary'],
): boolean {
  const count = summary?.untransmittedCount;
  return typeof count === 'number' && count > 0;
}

/**
 * 1000@833, has a capital-gains appendix (SPEC §7.4): yes when `hasCapitalGainsAppendix` is true,
 * `capitalGainsSummary.untransmittedCount` is greater than 0 or any capital-gains appendix exists,
 * otherwise no.
 */
export function deriveHasCapitalGainsAppendix(
  input: Pick<Report1214Input, 'declarations' | 'capitalGainsSummary' | 'capitalGains'>,
): boolean {
  return (
    input.declarations.hasCapitalGainsAppendix === true ||
    hasUntransmittedAppendices(input.capitalGainsSummary) ||
    (input.capitalGains?.length ?? 0) > 0
  );
}

/** 1000@832, has a foreign appendix (SPEC §7.4): yes exactly when `foreignAppendix` exists. */
export function deriveHasForeignAppendix(input: Pick<Report1214Input, 'foreignAppendix'>): boolean {
  return input.foreignAppendix !== undefined;
}
