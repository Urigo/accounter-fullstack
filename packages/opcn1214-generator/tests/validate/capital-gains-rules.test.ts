import { readdirSync } from 'node:fs';
import { parse1214 } from '../../src/api/parse.js';
import { validate1214 } from '../../src/index.js';
import type { CapitalGainsAppendix, Report1214Input } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import {
  forcedVirtualCurrencyAppendix,
  improvements,
  minimalInput,
  noWithholding1322Appendix,
  otherTransactionsAppendix,
  reitAppendix,
  section6Appendix,
  securitiesAppendix,
} from '../fixtures/builders.js';
import { goldenText, tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2024-06-30' };

/** The [ruleId, path, recordType, recordIndex] of every issue of `input` (errors and warnings). */
function issuesOf(input: Report1214Input) {
  const { errors, warnings } = validate1214(input, OPTIONS);
  return [...errors, ...warnings].map(issue => [
    issue.ruleId,
    issue.path,
    issue.recordType,
    issue.recordIndex,
  ]);
}

const RULE = 'cg.investmentFund.value';

/** The cg.investmentFund.value issues of minimalInput() with `appendices`. */
function fundIssuesOf(appendices: CapitalGainsAppendix[]): Issue[] {
  return runPipeline(minimalInput({ capitalGains: appendices }), OPTIONS).issues.filter(
    issue => issue.ruleId === RULE,
  );
}

describe('cg.investmentFund.value (SPEC §10.6)', () => {
  it('cg.investmentFund.value: 3060 allows only "no" (2) at 30xx@145 (p.43, SPEC §15 A-8)', () => {
    expect(fundIssuesOf([securitiesAppendix({ gainFromInvestmentFund: false })])).toEqual([]);
    expect(fundIssuesOf([securitiesAppendix({ gainFromInvestmentFund: undefined })])).toEqual([]);
    expect(
      fundIssuesOf([reitAppendix(), securitiesAppendix({ gainFromInvestmentFund: true })]),
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
    expect(fundIssuesOf([reitAppendix({ gainFromInvestmentFund: true })])).toEqual([]);
    expect(fundIssuesOf([reitAppendix({ gainFromInvestmentFund: undefined })])).toEqual([]);
    expect(fundIssuesOf([reitAppendix({ gainFromInvestmentFund: false })])).toEqual([
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
    expect(fundIssuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: false })])).toEqual(
      [],
    );
    expect(
      fundIssuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: undefined })]),
    ).toEqual([]);
    expect(fundIssuesOf([noWithholding1322Appendix({ gainFromInvestmentFund: true })])).toEqual([
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

describe('cg.improvements.code50Amount (SPEC §10.6)', () => {
  it('warns about an improvement without code50Amount, at the improvement', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            section6Appendix(),
            otherTransactionsAppendix({
              improvements: [{ date: '2015-01-01' }, improvements(2)[1]!, { date: '2016-01-01' }],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[0].code50Amount', '3077', 0],
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[2].code50Amount', '3077', 0],
    ]);
  });

  it('counts a code50Amount of 0 as absent (code 50x is not zeroAllowed)', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({
              improvements: [{ expense: 1, date: '2015-01-01', code50Amount: 0 }],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[0].improvements[0].code50Amount', '3077', 0],
    ]);
  });

  it('warns about a code50Amount with neither expense nor accumulated depreciation', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix(),
            otherTransactionsAppendix({
              improvements: [
                { date: '2015-01-01', code50Amount: 100 },
                { accumulatedDepreciation: 5, date: '2016-01-01', code50Amount: 100 },
                { expense: 5, date: '2017-01-01', code50Amount: 100 },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[0].code50Amount', '3077', 1],
    ]);
  });

  it('raises nothing for complete improvements or none', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({ improvements: improvements(5) }),
            otherTransactionsAppendix({ improvements: undefined }),
            otherTransactionsAppendix({ improvements: [] }),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe('cg.virtualCurrency.wallet (SPEC §10.6)', () => {
  it('requires a wallet address in a 3077 with code 071 = 1', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix(),
            otherTransactionsAppendix({ walletAddresses: undefined }),
          ],
        }),
      ),
    ).toEqual([['cg.virtualCurrency.wallet', 'capitalGains[1].walletAddresses', '3077', 1]]);
  });

  it('counts a blank address as no address, and accepts one in the second slot only', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({ walletAddresses: [' '] }),
            otherTransactionsAppendix({ walletAddresses: ['', '0x2'] }),
          ],
        }),
      ),
    ).toEqual([['cg.virtualCurrency.wallet', 'capitalGains[0].walletAddresses', '3077', 0]]);
  });

  it('requires nothing without code 071 or in a 3051 appendix', () => {
    const { walletAddresses: _walletAddresses, ...withoutWallet } = otherTransactionsAppendix({
      amounts: { '071': undefined },
    });
    const { walletAddresses: _forced, ...forcedWithoutWallet } = forcedVirtualCurrencyAppendix();
    expect(issuesOf(minimalInput({ capitalGains: [withoutWallet, forcedWithoutWallet] }))).toEqual(
      [],
    );
  });
});
