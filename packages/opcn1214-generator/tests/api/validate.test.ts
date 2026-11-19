import { validate1214, type PhonePrefix } from '../../src/index.js';
import { minimalInput } from '../fixtures/builders.js';

const OPTIONS = { today: () => '2025-03-31' };

describe('validate1214', () => {
  it('reports a valid input as valid with no issues', () => {
    expect(validate1214(minimalInput(), OPTIONS)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it('works without options', () => {
    expect(validate1214(minimalInput()).valid).toBe(true);
  });

  it('reports an invalid input with its errors, sorted', () => {
    const input = minimalInput({
      company: { registeredName: '', phone: { prefix: '03', number: '12' } },
      shareholders: [
        {
          idNumber: '123456782',
          fullName: '',
          isControllingShareholder: true,
          dividendRightsPercent: 100,
        },
      ],
    });
    const result = validate1214(input, OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.every(issue => issue.severity === 'error')).toBe(true);
    expect(result.warnings.every(issue => issue.severity === 'warning')).toBe(true);
    const paths = result.errors.map(issue => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'company.registeredName',
        'company.phone.number',
        'shareholders[0].fullName',
      ]),
    );
    // Sorted (SPEC §9.1): record 1000 by field position, then record 1020.
    expect(paths.indexOf('company.registeredName')).toBeLessThan(
      paths.indexOf('company.phone.number'),
    );
    expect(paths.indexOf('company.phone.number')).toBeLessThan(
      paths.indexOf('shareholders[0].fullName'),
    );
  });

  it('splits errors and warnings by severity', () => {
    // An invalid phone prefix is dropped with a warning (field.phonePrefix); the missing prefix
    // is then an error (field.required).
    const input = minimalInput({ company: { phone: { prefix: '01' as PhonePrefix } } });
    const result = validate1214(input, OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.warnings.map(issue => issue.ruleId)).toContain('field.phonePrefix');
    expect(result.errors.map(issue => issue.ruleId)).toContain('field.required');
  });

  it('reports an unsupported tax year', () => {
    const result = validate1214({ ...minimalInput(), taxYear: 2023 }, OPTIONS);
    expect(result).toEqual({
      valid: false,
      errors: [expect.objectContaining({ ruleId: 'struct.taxYear.unsupported' })],
      warnings: [],
    });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'x'],
    ['a number', 42],
    ['a boolean', true],
    ['an empty object', {}],
    ['an object with only a tax year', { taxYear: 2024 }],
    ['wrongly typed members', { taxYear: 2025, company: 'x', amounts: [], shareholders: {} }],
  ])('never throws for %s', (_, input) => {
    const result = validate1214(input, OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
