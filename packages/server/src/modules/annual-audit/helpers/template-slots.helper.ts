import type { AnnualAuditReportType } from '../types.js';

/**
 * Evidence stored on the step 05 (working templates) and step 09 (final, locked templates) rows of
 * `annual_audit_step_status`. `lockedTemplateName` is the legacy step 09 shape (one template for
 * both reports); new writes use the two explicit keys only.
 */
export interface TemplateSlotsEvidence {
  balanceSheetTemplateName?: string | null;
  profitAndLossTemplateName?: string | null;
  lockedTemplateName?: string | null;
}

export interface TemplateSlots {
  balanceSheet: string | null;
  profitAndLoss: string | null;
}

function asName(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reads the Balance Sheet and Profit and Loss template names that a step's evidence actually
 * holds. The legacy `lockedTemplateName` (one template for both reports) fills either slot, but an
 * unset slot is *not* filled from the other one: a report nobody locked stays unset. (Clients that
 * only display last year's templates may fall back across slots; anything that writes must not.)
 */
export function readTemplateSlots(evidence: unknown): TemplateSlots {
  if (!evidence || typeof evidence !== 'object') {
    return { balanceSheet: null, profitAndLoss: null };
  }
  const { balanceSheetTemplateName, profitAndLossTemplateName, lockedTemplateName } =
    evidence as TemplateSlotsEvidence;
  const legacy = asName(lockedTemplateName);
  return {
    balanceSheet: asName(balanceSheetTemplateName) ?? legacy,
    profitAndLoss: asName(profitAndLossTemplateName) ?? legacy,
  };
}

/** Returns a copy of `slots` with the given report slot (or both, when omitted) set to `name`. */
export function assignTemplateSlot(
  slots: TemplateSlots,
  name: string | null,
  reportType?: AnnualAuditReportType | null,
): TemplateSlots {
  return {
    balanceSheet: !reportType || reportType === 'BALANCE_SHEET' ? name : slots.balanceSheet,
    profitAndLoss: !reportType || reportType === 'PROFIT_AND_LOSS' ? name : slots.profitAndLoss,
  };
}

/** Serializes slots to the evidence shape written by new code (nulls omitted). */
export function templateSlotsToEvidence(slots: TemplateSlots): TemplateSlotsEvidence {
  const evidence: TemplateSlotsEvidence = {};
  if (slots.balanceSheet) evidence.balanceSheetTemplateName = slots.balanceSheet;
  if (slots.profitAndLoss) evidence.profitAndLossTemplateName = slots.profitAndLoss;
  return evidence;
}
