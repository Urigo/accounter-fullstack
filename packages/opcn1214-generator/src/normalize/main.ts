/** Normalizer of record 1000, the main form (SPEC §7.2–§7.4, §4.5). */
import type { YearLayout } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import { deriveCode008, deriveCode273 } from './derive.js';
import { headerValues } from './fields.js';
import { codeKey, pathFor } from './paths.js';
import { normalizeText } from './text.js';
import { todayInJerusalem } from './today.js';

const DEFAULT_SOFTWARE_NAME = 'ACCOUNTER';

export interface NormalizedMain {
  record: NormalizedRecord;
  /** Codes whose input value 0 was omitted because the code is not zeroAllowed (SPEC §4.5). */
  omittedZeroCodes: string[];
}

/** Record 1000 of `input`: header values, derived values and the code-amount section. */
export function normalizeMain(
  input: Report1214Input,
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedMain {
  const def = layout.records['1000'];
  const { company, declarations, meta } = input;
  const today = options.today ?? (() => todayInJerusalem());

  const { values, paths } = headerValues(def, 0, {
    taxYear: input.taxYear,
    // After normalization: a value that normalizes to '' is absent (SPEC §4.1) and gets the default.
    'meta.softwareName': normalizeText(meta?.softwareName ?? '') || DEFAULT_SOFTWARE_NAME,
    'meta.saveDate': meta?.saveDate ?? today(),
    'company.fileNumber': company.fileNumber,
    'company.registeredName': company.registeredName,
    'company.withholdingFileNumber': company.withholdingFileNumber,
    'company.vatFileNumber': company.vatFileNumber,
    'company.occupationDescription': company.occupationDescription,
    'company.mailingAddress': company.mailingAddress,
    'company.businessAddress': company.businessAddress,
    'company.booksAddress': company.booksAddress,
    'company.email': company.email,
    'company.phone.prefix': company.phone.prefix,
    'company.phone.number': company.phone.number,
    'company.fax.prefix': company.fax?.prefix,
    'company.fax.number': company.fax?.number,
    // 832 and 833 (SPEC §7.4): the skeleton model has no foreign or capital-gains appendix.
    hasForeignAppendix: false,
    'declarations.hasCapitalGainsAppendix': false,
    'declarations.hasTaxPlanningAction': declarations.hasTaxPlanningAction,
    'declarations.hadRelatedPartyTransactions': declarations.hadRelatedPartyTransactions,
    'declarations.controlsBodyOfPersons': declarations.controlsBodyOfPersons,
    'declarations.holdsRightsInBodyOfPersons': declarations.holdsRightsInBodyOfPersons,
    'declarations.appliesAccountingStandards': declarations.appliesAccountingStandards,
    'declarations.directorsReceivedOpinion': declarations.directorsReceivedOpinion,
    'declarations.tookReportablePosition': declarations.tookReportablePosition,
  });

  const derivedCodes: Readonly<Partial<Record<string, number>>> = {
    '008': deriveCode008(declarations),
    '273': deriveCode273(declarations),
  };
  const amounts: Readonly<Partial<Record<string, number>>> = input.amounts;
  const codes = new Map<string, number>();
  const omittedZeroCodes: string[] = [];
  for (const { code, derived, zeroAllowed } of def.codes) {
    const value = derived ? derivedCodes[code] : amounts[code];
    if (value === undefined) {
      continue;
    }
    if (value === 0 && !zeroAllowed) {
      omittedZeroCodes.push(code);
      continue;
    }
    codes.set(code, value);
    paths[codeKey(code)] = pathFor('1000', 0, codeKey(code));
  }

  return {
    record: { recordType: '1000', index: 0, values, codes, countries: [], paths },
    omittedZeroCodes,
  };
}
