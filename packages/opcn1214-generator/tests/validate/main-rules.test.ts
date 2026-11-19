import { generate1214 } from '../../src/api/generate.js';
import { parse1214 } from '../../src/api/parse.js';
import type { Report1214Input } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import { fullDeclarationsInput, fullMainInput, minimalInput } from '../fixtures/builders.js';
import { tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2024-06-30' };

const D4_RULES: readonly RuleId[] = [
  'main.familyCompany.fileNumber',
  'main.familyCompany.code080',
  'main.houseCompany.code084',
  'main.investmentLaw.flag',
  'main.beneficiaryEnterprise.noticeDate',
  'main.specialYear.balanceSheetDate',
  'main.kibbutz.code226',
  'main.buildingIncome.code259',
  'main.cgReasons.otherText',
  'main.reportablePositions.required',
  'main.reportablePositions.max',
];

function issuesOf(input: unknown, ruleId: RuleId): Issue[] {
  return runPipeline(input, OPTIONS).issues.filter(issue => issue.ruleId === ruleId);
}

/** Issues of `ruleId` in the file of `input` after `edit`. */
function fileIssuesOf(
  input: Report1214Input,
  edit: Parameters<typeof tamper>[1],
  ruleId: RuleId,
): Issue[] {
  const text = tamper(generate1214(input, OPTIONS).text, edit);
  return parse1214(text).issues.filter(issue => issue.ruleId === ruleId);
}

const FAMILY_COMPANY = { familyCompany: { representativeFileNumber: '300000007' } };

describe('record 1000 conditional requirements (SPEC §10.3)', () => {
  it.each([
    ['minimalInput', minimalInput()],
    ['fullDeclarationsInput', fullDeclarationsInput()],
    ['fullMainInput', fullMainInput()],
  ])('%s satisfies every conditional requirement', (_, input) => {
    const issues = runPipeline(input, OPTIONS).issues;
    expect(issues.filter(issue => D4_RULES.includes(issue.ruleId))).toEqual([]);
  });

  describe('missing codes point at the code-map key', () => {
    it.each([
      ['main.familyCompany.code080', { declarations: FAMILY_COMPANY }, '080', 15],
      ['main.houseCompany.code084', { declarations: { isHouseCompany: true } }, '084', 15],
      ['main.kibbutz.code226', { declarations: { isKibbutz: true } }, '226', 18],
      ['main.buildingIncome.code259', { declarations: { hasBuildingIncome: true } }, '259', 18],
    ] as const)('%s → amounts["%s"]', (ruleId, overrides, code, page) => {
      expect(issuesOf(minimalInput(overrides), ruleId)).toEqual([
        expect.objectContaining({
          ruleId,
          severity: 'error',
          path: `amounts["${code}"]`,
          recordType: '1000',
          recordIndex: 0,
          code,
          specRef: expect.objectContaining({ page }),
        }),
      ]);
    });
  });

  it.each([
    ['main.familyCompany.code080', { declarations: FAMILY_COMPANY, amounts: { '080': 0 } }],
    [
      'main.houseCompany.code084',
      { declarations: { isHouseCompany: true }, amounts: { '084': 0 } },
    ],
  ] as const)('%s: code value 0 satisfies the rule (zeroAllowed)', (ruleId, overrides) => {
    const { issues } = runPipeline(minimalInput(overrides), OPTIONS);
    expect(issues.filter(issue => issue.ruleId === ruleId)).toEqual([]);
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it.each([
    ['isHouseCompany: false', { isHouseCompany: false }],
    ['isKibbutz: false', { isKibbutz: false }],
    ['hasBuildingIncome: false', { hasBuildingIncome: false }],
    ['tookReportablePosition: false', { tookReportablePosition: false }],
  ] as const)('%s calls for nothing', (_, declarations) => {
    const issues = runPipeline(minimalInput({ declarations }), OPTIONS).issues;
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  describe('main.familyCompany.fileNumber', () => {
    it('reports an empty file number of an existing family company (JS callers)', () => {
      const input = minimalInput({
        declarations: { familyCompany: { representativeFileNumber: '' } },
        amounts: { '080': 0 },
      });
      expect(issuesOf(input, 'main.familyCompany.fileNumber')).toEqual([
        expect.objectContaining({
          path: 'declarations.familyCompany.representativeFileNumber',
          field: expect.objectContaining({ position: 837, length: 9 }),
        }),
      ]);
    });

    it('is reported on a parsed file whose 837 is zeros while 836 is marked', () => {
      const input = minimalInput({ declarations: FAMILY_COMPANY, amounts: { '080': 0 } });
      expect(
        fileIssuesOf(
          input,
          { line: 1, position: 837, value: '0'.repeat(9) },
          'main.familyCompany.fileNumber',
        ),
      ).toEqual([
        expect.objectContaining({ path: 'declarations.familyCompany.representativeFileNumber' }),
      ]);
    });
  });

  it('main.familyCompany.code080 is reported on a parsed file without code 080', () => {
    const input = minimalInput({ declarations: FAMILY_COMPANY });
    // A family company without 080 cannot be generated; mark 836 on a file that has no 080.
    const text = tamper(generate1214(minimalInput(), OPTIONS).text, {
      line: 1,
      position: 836,
      value: '1300000007',
    });
    expect(issuesOf(input, 'main.familyCompany.code080')).toHaveLength(1);
    expect(
      parse1214(text).issues.filter(issue => issue.ruleId === 'main.familyCompany.code080'),
    ).toEqual([expect.objectContaining({ path: 'amounts["080"]', code: '080' })]);
  });

  describe('main.investmentLaw.flag', () => {
    it.each([
      ['101', { '101': 1 }],
      ['102', { '102': 2 }],
      ['101 and 102', { '101': 9, '102': 9 }],
    ])('code %s without 849 → one issue at 849', (_, amounts) => {
      expect(issuesOf(minimalInput({ amounts }), 'main.investmentLaw.flag')).toEqual([
        expect.objectContaining({
          path: 'declarations.claimsCapitalInvestmentLawBenefits',
          field: expect.objectContaining({ position: 849 }),
        }),
      ]);
    });

    it('849 explicitly false is not marked', () => {
      const input = minimalInput({
        declarations: { claimsCapitalInvestmentLawBenefits: false },
        amounts: { '102': 2 },
      });
      expect(issuesOf(input, 'main.investmentLaw.flag')).toHaveLength(1);
    });
  });

  it.each([
    [
      'main.beneficiaryEnterprise.noticeDate',
      { beneficiaryEnterprise: { noticeDate: '2023-05-14' } },
      852,
      'declarations.beneficiaryEnterprise.noticeDate',
    ],
    [
      'main.specialYear.balanceSheetDate',
      { specialYear: { balanceSheetDate: '2024-09-30' } },
      864,
      'declarations.specialYear.balanceSheetDate',
    ],
  ] as const)(
    '%s: a parsed file with a blank date is reported at the date',
    (ruleId, declarations, position, path) => {
      const issues = fileIssuesOf(
        minimalInput({ declarations }),
        { line: 1, position, value: ' '.repeat(10) },
        ruleId,
      );
      expect(issues).toEqual([
        expect.objectContaining({
          severity: 'error',
          path,
          field: expect.objectContaining({ position, length: 10 }),
        }),
      ]);
    },
  );

  it('main.cgReasons.otherText: a blank text counts as absent', () => {
    const input = minimalInput({
      capitalGainsSummary: { untransmittedCount: 1, reasons: { other: true, otherText: '  ' } },
    });
    expect(issuesOf(input, 'main.cgReasons.otherText')).toEqual([
      expect.objectContaining({
        path: 'capitalGainsSummary.reasons.otherText',
        field: expect.objectContaining({ position: 968, length: 50 }),
      }),
    ]);
  });

  describe('main.reportablePositions', () => {
    it.each([
      ['absent', undefined],
      ['empty', []],
    ])('required: positions %s while tookReportablePosition', (_, reportablePositions) => {
      const input = minimalInput({
        declarations: { tookReportablePosition: true, reportablePositions },
      });
      expect(issuesOf(input, 'main.reportablePositions.required')).toEqual([
        expect.objectContaining({
          path: 'declarations.reportablePositions',
          field: expect.objectContaining({ position: 1034 }),
        }),
      ]);
    });

    it('max: a sixth position is a notice at [5]; the first five are still written', () => {
      const input = minimalInput({
        declarations: { tookReportablePosition: true, reportablePositions: [1, 2, 3, 4, 5, 6, 7] },
      });
      const { issues, report } = runPipeline(input, OPTIONS);
      expect(issues.filter(issue => issue.ruleId === 'main.reportablePositions.max')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'declarations.reportablePositions[5]',
          recordType: '1000',
          recordIndex: 0,
          value: 7,
          expected: 'at most 5 positions',
        }),
      ]);
      expect(report?.notices.map(notice => notice.ruleId)).toEqual([
        'main.reportablePositions.max',
      ]);
      expect(report?.records[0]?.values['declarations.reportablePositions[4]']).toBe(5);
    });
  });
});

describe('record 1000 consistency warnings (SPEC §10.3)', () => {
  const D5_RULES: readonly RuleId[] = [
    'main.kibbutz.code226Other',
    'main.reportablePositions.unexpected',
    'main.cgUntransmitted.reason',
    'main.cgUntransmitted.reasonWithoutCount',
    'main.bankAccount.withNoBank',
    'main.qualifyingCompany.purchaseAmounts',
    'main.qualifyingCompany.amortizationAmount',
    'main.attachments.code070',
    'main.attachments.code010',
  ];

  it.each([
    ['minimalInput', minimalInput()],
    ['fullDeclarationsInput', fullDeclarationsInput()],
    ['fullMainInput', fullMainInput()],
  ])('%s raises none of them', (_, input) => {
    const issues = runPipeline(input, OPTIONS).issues;
    expect(issues.filter(issue => D5_RULES.includes(issue.ruleId))).toEqual([]);
  });

  it('main.kibbutz.code226Other: code 226 = 9 while kibbutz, at amounts["226"]', () => {
    const input = minimalInput({ declarations: { isKibbutz: true }, amounts: { '226': 9 } });
    expect(issuesOf(input, 'main.kibbutz.code226Other')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        path: 'amounts["226"]',
        recordType: '1000',
        code: '226',
        value: 9,
      }),
    ]);
    expect(issuesOf(minimalInput({ amounts: { '226': 9 } }), 'main.kibbutz.code226Other')).toEqual(
      [],
    );
  });

  it('main.reportablePositions.unexpected: positions without tookReportablePosition', () => {
    const input = minimalInput({ declarations: { reportablePositions: [12, 7] } });
    expect(issuesOf(input, 'main.reportablePositions.unexpected')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        path: 'declarations.reportablePositions',
        field: expect.objectContaining({ position: 1034 }),
      }),
    ]);
    expect(
      issuesOf(
        minimalInput({ declarations: { reportablePositions: [] } }),
        'main.reportablePositions.unexpected',
      ),
    ).toEqual([]);
  });

  describe('main.cgUntransmitted', () => {
    it.each([
      ['lossOrNoGain', { lossOrNoGain: true }],
      ['overFiveImprovementBalances', { overFiveImprovementBalances: true }],
      ['over14Appendices', { over14Appendices: true }],
      ['other', { other: true, otherText: 'העסקה בוטלה' }],
    ])('reason: any one reason (%s) satisfies a positive count', (_, reasons) => {
      const input = minimalInput({ capitalGainsSummary: { untransmittedCount: 1, reasons } });
      expect(issuesOf(input, 'main.cgUntransmitted.reason')).toEqual([]);
    });

    it('reason: a count with every reason unmarked is reported at the reasons (964)', () => {
      const input = minimalInput({
        capitalGainsSummary: { untransmittedCount: 1, reasons: { lossOrNoGain: false } },
      });
      expect(issuesOf(input, 'main.cgUntransmitted.reason')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'capitalGainsSummary.reasons',
          field: expect.objectContaining({ position: 964 }),
        }),
      ]);
    });

    it.each([
      ['absent', undefined],
      ['0', 0],
    ])('reasonWithoutCount: a reason with the count %s, at 962', (_, untransmittedCount) => {
      const input = minimalInput({
        capitalGainsSummary: { untransmittedCount, reasons: { other: true, otherText: 'אחר' } },
      });
      expect(issuesOf(input, 'main.cgUntransmitted.reasonWithoutCount')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'capitalGainsSummary.untransmittedCount',
          field: expect.objectContaining({ position: 962 }),
        }),
      ]);
      expect(issuesOf(input, 'main.cgUntransmitted.reason')).toEqual([]);
    });
  });

  it('main.bankAccount.withNoBank: 1064 marked with a bank account, at 1064', () => {
    const input = minimalInput({
      declarations: { noBankAccount: true },
      bankAccount: { bank: '12', branch: '345', account: '678' },
    });
    expect(issuesOf(input, 'main.bankAccount.withNoBank')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        path: 'declarations.noBankAccount',
        field: expect.objectContaining({ position: 1064 }),
      }),
    ]);
    expect(
      issuesOf(
        minimalInput({ declarations: { noBankAccount: true } }),
        'main.bankAccount.withNoBank',
      ),
    ).toEqual([]);
  });

  describe('main.qualifyingCompany', () => {
    it.each([
      ['neither amount', {}, 1],
      ['amounts of 0', { israeliPurchaseAmount: 0, foreignPurchaseAmount: 0 }, 1],
      ['an Israeli amount', { israeliPurchaseAmount: 10 }, 0],
      ['a foreign amount', { foreignPurchaseAmount: 10 }, 0],
    ])('purchaseAmounts: purchased with %s', (_, amounts, count) => {
      const input = minimalInput({ qualifyingCompany: { purchased: true, ...amounts } });
      const issues = issuesOf(input, 'main.qualifyingCompany.purchaseAmounts');
      expect(issues).toHaveLength(count);
      if (count > 0) {
        expect(issues[0]).toEqual(
          expect.objectContaining({
            severity: 'warning',
            path: 'qualifyingCompany.israeliPurchaseAmount',
            field: expect.objectContaining({ position: 1066 }),
          }),
        );
      }
    });

    it('purchaseAmounts: not purchased calls for no amount', () => {
      const input = minimalInput({ qualifyingCompany: { purchased: false } });
      expect(issuesOf(input, 'main.qualifyingCompany.purchaseAmounts')).toEqual([]);
    });

    it('amortizationAmount: claimed without an amount, at 1091; 0 is an amount (A-21)', () => {
      const claimed = minimalInput({ qualifyingCompany: { amortizationClaimed: true } });
      expect(issuesOf(claimed, 'main.qualifyingCompany.amortizationAmount')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'qualifyingCompany.amortizationAmount',
          field: expect.objectContaining({ position: 1091 }),
        }),
      ]);
      const zero = minimalInput({
        qualifyingCompany: { amortizationClaimed: true, amortizationAmount: 0 },
      });
      expect(issuesOf(zero, 'main.qualifyingCompany.amortizationAmount')).toEqual([]);
      const text = generate1214(zero, OPTIONS).text;
      expect(
        parse1214(text).issues.filter(
          issue => issue.ruleId === 'main.qualifyingCompany.amortizationAmount',
        ),
      ).toEqual([]);
    });
  });

  describe('main.attachments', () => {
    it.each([
      ['main.attachments.code070', { donationReceiptsCount: 2 }, '070'],
      ['main.attachments.code010', { withholdingCertificatesCount: 3 }, '010'],
    ] as const)('%s: a count without the code, at amounts["%s"]', (ruleId, attachments, code) => {
      expect(issuesOf(minimalInput({ attachments }), ruleId)).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: `amounts["${code}"]`,
          recordType: '1000',
          code,
        }),
      ]);
    });

    it('a count of 0 calls for no code', () => {
      const input = minimalInput({
        attachments: { donationReceiptsCount: 0, withholdingCertificatesCount: 0 },
      });
      const issues = runPipeline(input, OPTIONS).issues;
      expect(issues.filter(issue => issue.ruleId.startsWith('main.attachments.'))).toEqual([]);
    });
  });

  it('warnings are reported on parsed files too (positions without 1030 = yes)', () => {
    const input = minimalInput({
      declarations: { tookReportablePosition: true, reportablePositions: [12] },
    });
    // 1000@1030: 2 = no.
    expect(
      fileIssuesOf(
        input,
        { line: 1, position: 1030, value: '2' },
        'main.reportablePositions.unexpected',
      ),
    ).toEqual([expect.objectContaining({ path: 'declarations.reportablePositions' })]);
  });
});
