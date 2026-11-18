import {
  Opcn1214Error,
  Opcn1214InternalError,
  Opcn1214ParseError,
  Opcn1214UnsupportedYearError,
  Opcn1214ValidationError,
} from '../src/errors.js';
import type { Issue } from '../src/validate/issue.js';
import type { RuleId } from '../src/validate/rules.js';

/** These tests only format issues: rule IDs of later steps (and made-up ones) are fine here. */
function issue(ruleId: string, path: string): Issue {
  return { ruleId: ruleId as RuleId, severity: 'error', message: `${ruleId} failed`, path };
}

describe('errors', () => {
  describe('Opcn1214Error', () => {
    it('sets name, extends Error and keeps the issues', () => {
      const issues = [issue('field.required', 'company.phone.number')];
      const error = new Opcn1214Error('1214 report has 1 error', issues);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Opcn1214Error');
      expect(error.issues).toEqual(issues);
    });

    it('summarizes the issues in the message (rule ID at path)', () => {
      const error = new Opcn1214Error('1214 report has 2 errors', [
        issue('field.required', 'company.phone.number'),
        issue('field.enum', 'amounts["080"]'),
      ]);
      expect(error.message).toBe(
        '1214 report has 2 errors: field.required at company.phone.number; field.enum at amounts["080"]',
      );
    });

    it('names report-level issues by rule ID only', () => {
      const error = new Opcn1214Error('1214 report has 1 error', [
        issue('struct.shareholders.min', ''),
      ]);
      expect(error.message).toBe('1214 report has 1 error: struct.shareholders.min');
    });

    it('lists at most the first five issues', () => {
      const issues = Array.from({ length: 7 }, (_, i) => issue(`rule.${i}`, `path${i}`));
      const error = new Opcn1214Error('1214 report has 7 errors', issues);
      expect(error.message).toBe(
        '1214 report has 7 errors: rule.0 at path0; rule.1 at path1; rule.2 at path2; ' +
          'rule.3 at path3; rule.4 at path4; … and 2 more',
      );
      expect(error.issues).toHaveLength(7);
    });

    it('keeps the plain message when there are no issues', () => {
      expect(new Opcn1214Error('nothing to report', []).message).toBe('nothing to report');
    });

    it('passes the cause through when wrapping', () => {
      const cause = new Error('root cause');
      expect(new Opcn1214Error('wrapped', [], { cause }).cause).toBe(cause);
    });
  });

  describe('Opcn1214UnsupportedYearError', () => {
    it('extends Opcn1214Error, sets name and taxYear, and carries one issue', () => {
      const error = new Opcn1214UnsupportedYearError(2023, [2024, 2025]);
      expect(error).toBeInstanceOf(Opcn1214Error);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Opcn1214UnsupportedYearError');
      expect(error.taxYear).toBe(2023);
      expect(error.issues).toEqual([
        {
          ruleId: 'struct.taxYear.unsupported',
          severity: 'error',
          message: 'Tax year 2023 is not supported (supported: 2024, 2025).',
          path: 'taxYear',
          value: 2023,
          expected: 'one of 2024, 2025',
        },
      ]);
      expect(error.message).toBe(
        'Unsupported tax year 2023: struct.taxYear.unsupported at taxYear',
      );
    });
  });

  describe('Opcn1214ValidationError', () => {
    it('extends Opcn1214Error, sets name and counts errors and warnings in the message', () => {
      const warning: Issue = {
        ...issue('field.phonePrefix', 'company.phone.prefix'),
        severity: 'warning',
      };
      const issues = [issue('field.required', 'company.phone.prefix'), warning];
      const error = new Opcn1214ValidationError(issues);
      expect(error).toBeInstanceOf(Opcn1214Error);
      expect(error.name).toBe('Opcn1214ValidationError');
      expect(error.issues).toEqual(issues);
      expect(error.message).toBe(
        '1214 report has 1 error and 1 warning: field.required at company.phone.prefix; ' +
          'field.phonePrefix at company.phone.prefix',
      );
    });

    it('pluralizes and leaves out a zero warning count', () => {
      const issues = [issue('field.required', 'a'), issue('field.length', 'b')];
      expect(new Opcn1214ValidationError(issues).message).toBe(
        '1214 report has 2 errors: field.required at a; field.length at b',
      );
    });
  });

  describe('Opcn1214ParseError', () => {
    it('extends Opcn1214Error, sets name and counts the problems in the message', () => {
      const issues = [issue('parse.lineLength', ''), issue('parse.numeric', 'company.fileNumber')];
      const error = new Opcn1214ParseError(issues);
      expect(error).toBeInstanceOf(Opcn1214Error);
      expect(error.name).toBe('Opcn1214ParseError');
      expect(error.issues).toEqual(issues);
      expect(error.message).toBe(
        '1214 file has 2 structural problems: parse.lineLength; parse.numeric at company.fileNumber',
      );
      expect(new Opcn1214ParseError([issue('parse.empty', '')]).message).toBe(
        '1214 file has 1 structural problem: parse.empty',
      );
    });
  });

  describe('Opcn1214InternalError', () => {
    it('extends Error (not Opcn1214Error) and sets name', () => {
      const cause = new Error('root cause');
      const error = new Opcn1214InternalError('line length 10 != 4232', { cause });
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(Opcn1214Error);
      expect(error.name).toBe('Opcn1214InternalError');
      expect(error.message).toBe('line length 10 != 4232');
      expect(error.cause).toBe(cause);
    });
  });
});
