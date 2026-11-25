import { describe, expect, it } from 'vitest';
import { form1214SectionOfPath, groupForm1214IssuesByPath } from '../issues.js';

describe('form1214SectionOfPath', () => {
  it('maps a report input path to the page section that edits it', () => {
    expect(form1214SectionOfPath('shareholders[0].fullName')).toBe('shareholders');
    expect(form1214SectionOfPath('company.phone')).toBe('company');
    expect(form1214SectionOfPath('preparer.name')).toBe('company');
    expect(form1214SectionOfPath('declarations.hasTaxPlanningAction')).toBe('declarations');
    expect(form1214SectionOfPath('relatedCompanies')).toBe('related-companies');
    expect(form1214SectionOfPath('rdInvestments[5]')).toBe('rd-investments');
    expect(form1214SectionOfPath('amounts["165"]')).toBe('amounts');
    expect(form1214SectionOfPath('amounts.165')).toBe('amounts');
  });

  it('has no section for unknown or missing paths', () => {
    expect(form1214SectionOfPath('taxYear')).toBeUndefined();
    expect(form1214SectionOfPath(null)).toBeUndefined();
    expect(form1214SectionOfPath(undefined)).toBeUndefined();
  });
});

describe('groupForm1214IssuesByPath', () => {
  it('groups issues by path in first-seen order, report-level issues first under General', () => {
    const issues = [
      { ruleId: 'a', path: 'shareholders[0].fullName' },
      { ruleId: 'b', path: null },
      { ruleId: 'c', path: 'company.phone' },
      { ruleId: 'd', path: 'shareholders[0].fullName' },
      { ruleId: 'e' },
    ];
    expect(groupForm1214IssuesByPath(issues)).toEqual([
      { title: 'General', issues: [issues[1], issues[4]] },
      {
        title: 'shareholders[0].fullName',
        section: 'shareholders',
        issues: [issues[0], issues[3]],
      },
      { title: 'company.phone', section: 'company', issues: [issues[2]] },
    ]);
  });

  it('returns no groups for no issues', () => {
    expect(groupForm1214IssuesByPath([])).toEqual([]);
  });
});
