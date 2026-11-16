import { describe, expect, it } from 'vitest';
import { findStepEvidence, parseFinalTemplates, parseWorkingTemplates } from '../template-slots.js';

describe('parseFinalTemplates', () => {
  it('uses a legacy single template for both reports', () => {
    expect(parseFinalTemplates(JSON.stringify({ lockedTemplateName: 'legacy' }))).toEqual({
      balanceSheetTemplateName: 'legacy',
      profitAndLossTemplateName: 'legacy',
    });
  });

  it('reads both explicit slots', () => {
    expect(
      parseFinalTemplates(
        JSON.stringify({ balanceSheetTemplateName: 'bs', profitAndLossTemplateName: 'pnl' }),
      ),
    ).toEqual({ balanceSheetTemplateName: 'bs', profitAndLossTemplateName: 'pnl' });
  });

  it('fills a missing slot from the other one', () => {
    expect(parseFinalTemplates(JSON.stringify({ profitAndLossTemplateName: 'pnl' }))).toEqual({
      balanceSheetTemplateName: 'pnl',
      profitAndLossTemplateName: 'pnl',
    });
  });

  it('prefers explicit slots over the legacy key', () => {
    expect(
      parseFinalTemplates(
        JSON.stringify({ lockedTemplateName: 'legacy', profitAndLossTemplateName: 'pnl' }),
      ),
    ).toEqual({ balanceSheetTemplateName: 'legacy', profitAndLossTemplateName: 'pnl' });
  });

  it('returns empty slots for missing or invalid evidence', () => {
    const empty = { balanceSheetTemplateName: null, profitAndLossTemplateName: null };
    expect(parseFinalTemplates(null)).toEqual(empty);
    expect(parseFinalTemplates('not json')).toEqual(empty);
    expect(parseFinalTemplates('"a string"')).toEqual(empty);
  });
});

describe('parseWorkingTemplates', () => {
  it('does not fill a missing slot from the other one', () => {
    expect(parseWorkingTemplates(JSON.stringify({ balanceSheetTemplateName: 'bs' }))).toEqual({
      balanceSheetTemplateName: 'bs',
      profitAndLossTemplateName: null,
    });
  });
});

describe('findStepEvidence', () => {
  it('finds the evidence of the requested step', () => {
    const statuses = [
      { stepId: '5', evidence: 'five' },
      { stepId: '9', evidence: 'nine' },
    ];
    expect(findStepEvidence(statuses, '9')).toBe('nine');
    expect(findStepEvidence(statuses, '3')).toBeNull();
    expect(findStepEvidence(undefined, '9')).toBeNull();
  });
});
