import { readdirSync } from 'node:fs';
import { parse1214 } from '../../src/api/parse.js';
import { validate1214 } from '../../src/api/validate.js';
import type { CapitalGainsAppendix, Report1214Input } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import {
  minimalInput,
  noWithholding1322Appendix,
  reitAppendix,
  securitiesAppendix,
} from '../fixtures/builders.js';
import { goldenText, tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const RULE = 'cg.investmentFund.value';

function issuesOf(appendices: CapitalGainsAppendix[]): Issue[] {
  return runPipeline(minimalInput({ capitalGains: appendices }), OPTIONS).issues.filter(
    issue => issue.ruleId === RULE,
  );
}

describe('capital-gains appendix rules (SPEC §10.6)', () => {
  it('cg.investmentFund.value: 3060 allows only "no" (2) at 30xx@145 (p.43, SPEC §15 A-8)', () => {
    expect(issuesOf([securitiesAppendix({ gainFromInvestmentFund: false })])).toEqual([]);
    expect(issuesOf([securitiesAppendix({ gainFromInvestmentFund: undefined })])).toEqual([]);
    expect(
      issuesOf([reitAppendix(), securitiesAppendix({ gainFromInvestmentFund: true })]),
    ).toEqual([
      expect.objectContaining({
        ruleId: RULE,
        severity: 'error',
        path: 'capitalGains[1].gainFromInvestmentFund',
        recordType: '3060',
        recordIndex: 0,
        field: expect.objectContaining({ position: 145, length: 1 }),
        value: true,
        expected: 'false (2) or absent',
        specRef: { page: 43 },
      }),
    ]);
  });

  it('cg.investmentFund.value: 3064 allows only "yes" (1) at 30xx@145 (p.48)', () => {
    expect(issuesOf([reitAppendix({ gainFromInvestmentFund: true })])).toEqual([]);
    expect(issuesOf([reitAppendix({ gainFromInvestmentFund: undefined })])).toEqual([]);
    expect(issuesOf([reitAppendix({ gainFromInvestmentFund: false })])).toEqual([
      expect.objectContaining({
        ruleId: RULE,
        path: 'capitalGains[0].gainFromInvestmentFund',
        recordType: '3064',
        value: false,
        expected: 'true (1) or absent',
        specRef: { page: 48 },
      }),
    ]);
  });

  it('cg.investmentFund.value: 3065 allows only "no" (2) at 30xx@145 (p.50)', () => {
    expect(issuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: false })])).toEqual([]);
    expect(issuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: undefined })])).toEqual(
      [],
    );
    expect(issuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: true })])).toEqual([
      expect.objectContaining({
        ruleId: RULE,
        path: 'capitalGains[0].gainFromInvestmentFund',
        recordType: '3065',
        value: true,
        expected: 'false (2) or absent',
        specRef: { page: 50 },
      }),
    ]);
  });

  it('cg.investmentFund.value: also in a parsed file', () => {
    // cg-60 writes 3060@145 = 2 ("no"); "yes" is not allowed there.
    const text = goldenText('cg-60');
    const line = text.split('\r\n').findIndex(candidate => candidate.slice(4, 8) === '3060') + 1;
    expect(text.split('\r\n')[line - 1]?.slice(144, 145)).toBe('2');
    expect(
      parse1214(tamper(text, { line, position: 145, value: '1' })).issues.filter(
        issue => issue.ruleId === RULE,
      ),
    ).toEqual([
      expect.objectContaining({ path: 'capitalGains[0].gainFromInvestmentFund', value: true }),
    ]);
  });

  it('cg.investmentFund.value: every golden input complies', async () => {
    const dir = new URL('../fixtures/golden/', import.meta.url);
    const names = readdirSync(dir).filter(file => file.endsWith('.input.ts'));
    expect(names).toContain('cg-60.input.ts');
    for (const name of names) {
      const fixture = (await import(new URL(name, dir).href)) as { input: Report1214Input };
      const { errors, warnings } = validate1214(fixture.input, OPTIONS);
      expect([name, [...errors, ...warnings].filter(issue => issue.ruleId === RULE)]).toEqual([
        name,
        [],
      ]);
    }
  });
});
