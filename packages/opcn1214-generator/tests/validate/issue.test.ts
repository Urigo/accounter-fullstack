import { getLayout } from '../../src/layout/registry.js';
import type { RecordType } from '../../src/layout/types.js';
import { compareIssues, makeIssue, type Issue } from '../../src/validate/issue.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return { ruleId: 'field.required', severity: 'error', message: 'm', path: '', ...overrides };
}

function sorted(issues: Issue[]): Issue[] {
  return [...issues].sort(compareIssues);
}

const FIELD = { length: 1, nameHe: 'x' };

describe('compareIssues (SPEC §9.1 sorting)', () => {
  it('orders by report index first (issues without one first)', () => {
    const a = issue({ reportIndex: 1, recordType: '1000' });
    const b = issue({ reportIndex: 0, recordType: '3077' });
    const c = issue({ recordType: '9999' });
    expect(sorted([a, b, c])).toEqual([c, b, a]);
  });

  it('orders by record order (SPEC §3.3), report-level issues first', () => {
    const order: RecordType[] = ['3077', '2200', '1020', '1000', '3027', '9999', '2000', '1010'];
    const issues = order.map(recordType => issue({ recordType }));
    const report = issue();
    expect(sorted([...issues, report]).map(i => i.recordType)).toEqual([
      undefined,
      '1000',
      '1010',
      '1020',
      '2000',
      '2200',
      '3027',
      '3077',
      '9999',
    ]);
  });

  it('uses the record order of the layout', () => {
    const records = getLayout(2024).records;
    const byLayout = (Object.keys(records) as RecordType[]).sort(
      (a, b) => records[a].order - records[b].order,
    );
    const issues = [...byLayout].reverse().map(recordType => issue({ recordType }));
    expect(sorted(issues).map(i => i.recordType)).toEqual(byLayout);
  });

  it('orders by record index within a record type', () => {
    const a = issue({ recordType: '1020', recordIndex: 2 });
    const b = issue({ recordType: '1020', recordIndex: 0 });
    expect(sorted([a, b])).toEqual([b, a]);
  });

  it('orders header fields by position, then codes by code, record-level issues first', () => {
    const code081 = issue({ recordType: '1000', recordIndex: 0, code: '081' });
    const code018 = issue({ recordType: '1000', recordIndex: 0, code: '018' });
    const at493 = issue({ recordType: '1000', recordIndex: 0, field: { position: 493, ...FIELD } });
    const at137 = issue({ recordType: '1000', recordIndex: 0, field: { position: 137, ...FIELD } });
    const record = issue({ recordType: '1000', recordIndex: 0 });
    expect(sorted([code081, at493, code018, record, at137])).toEqual([
      record,
      at137,
      at493,
      code018,
      code081,
    ]);
  });

  it('orders by rule ID last', () => {
    const a = issue({ ruleId: 'field.length', path: 'company.registeredName' });
    const b = issue({ ruleId: 'field.charset', path: 'company.registeredName' });
    expect(sorted([a, b])).toEqual([b, a]);
  });
});

describe('makeIssue', () => {
  it('takes the severity from the catalogue', () => {
    expect(makeIssue('field.required', { message: 'missing', path: 'taxYear' })).toEqual({
      ruleId: 'field.required',
      severity: 'error',
      message: 'missing',
      path: 'taxYear',
    });
  });

  it('redacts long string values to 100 characters', () => {
    const made = makeIssue('field.length', {
      message: 'too long',
      path: '',
      value: 'א'.repeat(150),
    });
    expect(made.value).toBe(`${'א'.repeat(99)}…`);
    expect(makeIssue('field.length', { message: '', path: '', value: 'abc' }).value).toBe('abc');
  });
});
