/**
 * Annual audit dynamic-report templates come in two slots — Balance Sheet and Profit and Loss.
 * Step 09 stores the final (locked) ones as JSON evidence on its step status row. Mirrors `packages/server/src/modules/annual-audit/helpers/template-slots.helper.ts`.
 */
export interface TemplateSlots {
  balanceSheetTemplateName: string | null;
  profitAndLossTemplateName: string | null;
}

interface TemplateSlotsEvidence {
  balanceSheetTemplateName?: unknown;
  profitAndLossTemplateName?: unknown;
  /** Legacy step 09 shape: one template for both reports */
  lockedTemplateName?: unknown;
}

const EMPTY_SLOTS: TemplateSlots = {
  balanceSheetTemplateName: null,
  profitAndLossTemplateName: null,
};

function asName(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvidence(evidence: string | null | undefined): TemplateSlotsEvidence | null {
  if (!evidence) return null;
  try {
    const parsed: unknown = JSON.parse(evidence);
    return parsed && typeof parsed === 'object' ? (parsed as TemplateSlotsEvidence) : null;
  } catch {
    return null;
  }
}

/**
 * Final (step 09) templates as last year's baseline: a single template — legacy
 * `lockedTemplateName`, or only one report locked — serves both reports. For display only; step 09
 * itself uses `parseLockedTemplates`.
 */
export function parseFinalTemplates(evidence: string | null | undefined): TemplateSlots {
  const parsed = parseEvidence(evidence);
  if (!parsed) return EMPTY_SLOTS;
  const bs = asName(parsed.balanceSheetTemplateName);
  const pnl = asName(parsed.profitAndLossTemplateName);
  const legacy = asName(parsed.lockedTemplateName);
  return {
    balanceSheetTemplateName: bs ?? legacy ?? pnl,
    profitAndLossTemplateName: pnl ?? legacy ?? bs,
  };
}

/**
 * The templates a step 09 row actually locks, per report. The legacy `lockedTemplateName` (one
 * template for both reports) fills either report, but a report nobody locked stays empty — unlike
 * `parseFinalTemplates`, which fills it from the other report.
 */
export function parseLockedTemplates(evidence: string | null | undefined): TemplateSlots {
  const parsed = parseEvidence(evidence);
  if (!parsed) return EMPTY_SLOTS;
  const legacy = asName(parsed.lockedTemplateName);
  return {
    balanceSheetTemplateName: asName(parsed.balanceSheetTemplateName) ?? legacy,
    profitAndLossTemplateName: asName(parsed.profitAndLossTemplateName) ?? legacy,
  };
}

/** The evidence of one step out of an `annualAuditStepStatuses` result. */
export function findStepEvidence(
  statuses: ReadonlyArray<{ stepId: string; evidence?: string | null }> | null | undefined,
  stepId: string,
): string | null {
  return statuses?.find(s => s.stepId === stepId)?.evidence ?? null;
}
