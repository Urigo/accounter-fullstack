import { getLayout } from '../../src/layout/registry.js';
import type { NormalizedRecord, NormalizedReport } from '../../src/model/normalized.js';
import { denormalize } from '../../src/normalize/denormalize.js';
import { normalizeReport } from '../../src/normalize/report.js';
import {
  breakdownCountries,
  foreignAppendix,
  minimalInput,
  noWithholding1322Appendix,
  noWithholding1326Appendix,
  rdInvestments,
  reitAppendix,
  relatedCompanies,
  section6Appendices,
  section6Appendix,
  securitiesAppendix,
  withholders,
} from '../fixtures/builders.js';

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

describe('denormalize: related companies (records 1010)', () => {
  it('reads 1010 records back as relatedCompanies, relation type as its literal', () => {
    const companies = relatedCompanies(3);
    const report = normalizeReport(minimalInput({ relatedCompanies: companies }), LAYOUT, OPTIONS);
    expect(denormalize(report).relatedCompanies).toEqual(companies);
  });

  it('keeps a relation type code without a literal as-is (a parsed file)', () => {
    const report = normalizeReport(
      minimalInput({ relatedCompanies: relatedCompanies(1) }),
      LAYOUT,
      OPTIONS,
    );
    const related = report.records.find(record => record.recordType === '1010');
    if (!related) {
      throw new Error('expected a 1010 record');
    }
    related.values.relationType = 9;
    expect(denormalize(report).relatedCompanies?.[0]?.relationType).toBe(9);
  });

  it('leaves no relatedCompanies without 1010 records', () => {
    expect(denormalize(reportWith(() => undefined))).not.toHaveProperty('relatedCompanies');
  });
});

describe('denormalize: R&D investments (records 1030)', () => {
  it('reads 1030 records back as rdInvestments, without the derived affiliation', () => {
    const investments = rdInvestments(5);
    const report = normalizeReport(minimalInput({ rdInvestments: investments }), LAYOUT, OPTIONS);
    expect(denormalize(report).rdInvestments).toEqual(investments);
  });

  it('leaves no rdInvestments without 1030 records', () => {
    expect(denormalize(reportWith(() => undefined))).not.toHaveProperty('rdInvestments');
  });
});

describe('denormalize: foreign appendix (record 2000)', () => {
  it('reads a 2000 record back as foreignAppendix, header members and amounts', () => {
    const appendix = foreignAppendix({ amounts: { '442': 0 } });
    const report = normalizeReport(minimalInput({ foreignAppendix: appendix }), LAYOUT, OPTIONS);
    expect(denormalize(report).foreignAppendix).toEqual(appendix);
  });

  it('keeps an empty amounts map and a "no" refund declaration', () => {
    const appendix = { taxRefundDeclaration: false, amounts: {} };
    const report = normalizeReport(minimalInput({ foreignAppendix: appendix }), LAYOUT, OPTIONS);
    expect(denormalize(report).foreignAppendix).toEqual(appendix);
  });

  it('groups the 2200 records under countryBreakdown, keyed by their code, without affiliation', () => {
    const appendix = foreignAppendix({
      amounts: { '420': 5000, '439': 1 },
      countryBreakdown: {
        '420': { deductionsOffsetsAndExemptions: 300, countries: breakdownCountries(3) },
        '439': { countries: [{ country: '-88', income: 0 }] },
      },
    });
    const report = normalizeReport(minimalInput({ foreignAppendix: appendix }), LAYOUT, OPTIONS);
    expect(denormalize(report).foreignAppendix).toEqual(appendix);
  });

  it('leaves no countryBreakdown without 2200 records', () => {
    const report = normalizeReport(
      minimalInput({ foreignAppendix: foreignAppendix() }),
      LAYOUT,
      OPTIONS,
    );
    expect(denormalize(report).foreignAppendix).not.toHaveProperty('countryBreakdown');
  });

  it('leaves no foreignAppendix without a 2000 record, whatever 832 says', () => {
    const report = reportWith(main => {
      main.values.hasForeignAppendix = true;
    });
    expect(denormalize(report)).not.toHaveProperty('foreignAppendix');
  });
});

describe('denormalize: capital-gains appendices (records 30xx)', () => {
  it('reads 3063 records back as capitalGains, without the derived symbol fields', () => {
    const appendices = [section6Appendix(), section6Appendix({ foreignAsset: false })];
    const report = normalizeReport(minimalInput({ capitalGains: appendices }), LAYOUT, OPTIONS);
    expect(denormalize(report).capitalGains).toEqual(appendices);
  });

  it('reads 3060 and 3064 records back with their withholders, in file order', () => {
    const appendices = [
      reitAppendix({ withholders: withholders(4) }),
      securitiesAppendix({ withholders: [{}, {}, { account: '000000001' }] }),
      securitiesAppendix({ withholders: undefined }),
    ];
    const report = normalizeReport(minimalInput({ capitalGains: appendices }), LAYOUT, OPTIONS);
    expect(denormalize(report).capitalGains).toEqual([
      appendices[1],
      { ...securitiesAppendix(), withholders: undefined },
      appendices[0],
    ]);
    expect(denormalize(report).capitalGains?.[1]).not.toHaveProperty('withholders');
  });

  it('reads 3065 and 3066 records back with the withholding status literal, without the sequence', () => {
    const appendices = [
      noWithholding1326Appendix({ withholdingStatus: 'notWithheldFirstHalf' }),
      noWithholding1322Appendix({ withholders: withholders(4) }),
      { symbol: 66 as const, amounts: {} },
      noWithholding1322Appendix({ withholdingStatus: 'notWithheldSecondHalf' }),
    ];
    const report = normalizeReport(minimalInput({ capitalGains: appendices }), LAYOUT, OPTIONS);
    const capitalGains = denormalize(report).capitalGains;
    expect(capitalGains).toEqual([appendices[1], appendices[3], appendices[0], appendices[2]]);
    expect(capitalGains?.[3]).not.toHaveProperty('withholdingStatus');
    for (const appendix of capitalGains ?? []) {
      expect(appendix).not.toHaveProperty('sequenceNumber');
    }
  });

  it('keeps an appendix with no header member and no codes', () => {
    const appendices = [{ symbol: 63 as const, amounts: {} }];
    const report = normalizeReport(minimalInput({ capitalGains: appendices }), LAYOUT, OPTIONS);
    expect(denormalize(report).capitalGains).toEqual(appendices);
  });

  it('leaves no capitalGains without capital-gains records', () => {
    expect(denormalize(reportWith(() => undefined))).not.toHaveProperty('capitalGains');
  });

  it('reads 833 = yes back as hasCapitalGainsAppendix only when nothing else explains it', () => {
    const marked = (input: Parameters<typeof minimalInput>[0]) => {
      const report = normalizeReport(minimalInput(input), LAYOUT, OPTIONS);
      return denormalize(report).declarations.hasCapitalGainsAppendix;
    };
    expect(marked({ declarations: { hasCapitalGainsAppendix: true } })).toBe(true);
    expect(
      marked({
        declarations: { hasCapitalGainsAppendix: true },
        capitalGains: section6Appendices(1),
      }),
    ).toBeUndefined();
    expect(
      marked({
        declarations: { hasCapitalGainsAppendix: true },
        capitalGainsSummary: { untransmittedCount: 1 },
      }),
    ).toBeUndefined();
  });
});
