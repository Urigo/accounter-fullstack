import { getLayout } from '../../src/layout/registry.js';
import type { NormalizedRecord, NormalizedReport } from '../../src/model/normalized.js';
import { denormalize } from '../../src/normalize/denormalize.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2025-03-31' };

/** The normalized report of minimalInput() with record 1000 changed by `edit`. */
function reportWith(edit: (main: NormalizedRecord) => void): NormalizedReport {
  const report = normalizeReport(minimalInput(), LAYOUT, OPTIONS);
  const main = report.records[0];
  if (main?.recordType !== '1000') {
    throw new Error('expected record 1000 first');
  }
  edit(main);
  return report;
}

describe('denormalize: derived codes (SPEC §7.4)', () => {
  it('reads 277/278/280 back as bankAccount, account padded to 9 digits', () => {
    const report = reportWith(main => {
      main.codes.set('277', 678).set('278', 1002).set('280', 1);
    });
    const input = denormalize(report);
    expect(input.bankAccount).toEqual({ bank: '01', branch: '002', account: '000000678' });
    expect(input.amounts).toEqual(minimalInput().amounts);
  });

  it('reads a bank code written as absent as zeros', () => {
    const report = reportWith(main => {
      main.codes.set('280', 1);
    });
    expect(denormalize(report).bankAccount).toEqual({
      bank: '00',
      branch: '000',
      account: '000000000',
    });
  });

  it('leaves no bankAccount without 277, 278 and 280', () => {
    expect(denormalize(reportWith(() => undefined))).not.toHaveProperty('bankAccount');
  });

  it.each([
    [8, 'obliged'],
    [9, 'notObliged'],
  ])('reads 297 = %i as form6111Obligation %s when 834 is absent', (code297, expected) => {
    const report = reportWith(main => {
      main.codes.set('297', code297);
    });
    expect(denormalize(report).declarations.form6111Obligation).toBe(expected);
  });

  it('ignores 297 when 834 is present: 834 is the source of truth', () => {
    const report = reportWith(main => {
      main.values['declarations.form6111Obligation'] = 2;
      main.codes.set('297', 8);
    });
    expect(denormalize(report).declarations.form6111Obligation).toBe('notObliged');
  });

  it('ignores a 297 value other than 8 or 9', () => {
    const report = reportWith(main => {
      main.codes.set('297', 5);
    });
    expect(denormalize(report).declarations).not.toHaveProperty('form6111Obligation');
  });
});
