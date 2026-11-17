/**
 * Input paths of model keys (SPEC §7.3, §9.1 path grammar). Shared by the normalizer, which fills
 * NormalizedRecord.paths, and the parser, which reports issues against the reconstructed input.
 */
import { isCapitalGainsRecordType } from '../layout/capital-gains.js';
import type { RecordType } from '../layout/types.js';
import { DERIVED_MAIN_CODES } from '../model/codes.generated.js';
import type { NormalizedRecord } from '../model/normalized.js';

/** Prefix of code-amount keys in NormalizedRecord.paths: `code:${code}`. */
const CODE_KEY_PREFIX = 'code:';

/** Derived header keys (`(derived) ` rows of fields.csv) of the records mapped here. */
const DERIVED_KEYS: Readonly<Partial<Record<RecordType, readonly string[]>>> = {
  '1000': ['hasForeignAppendix'],
  '1010': ['serialNumber'],
  '1020': ['serialNumber'],
  '1030': ['affiliation'],
  '3060': ['transactionSymbol', 'appendixNumber'],
  '3063': ['transactionSymbol', 'appendixNumber'],
  '3064': ['transactionSymbol', 'appendixNumber'],
  '3065': ['transactionSymbol', 'appendixNumber', 'sequenceNumber'],
  '3066': ['transactionSymbol', 'appendixNumber', 'sequenceNumber'],
};

const DERIVED_CODES: Readonly<Partial<Record<RecordType, readonly string[]>>> = {
  '1000': DERIVED_MAIN_CODES,
};

/**
 * Declaration objects of record 1000 whose presence is a flag (SPEC §7.3): the object's input path
 * → its flag key and the key of its one member. The flag's input path is the object's.
 */
export const PRESENCE_OBJECTS = {
  'declarations.familyCompany': {
    flag: 'declarations.familyCompany.isFamilyCompany',
    member: 'declarations.familyCompany.representativeFileNumber',
  },
  'declarations.beneficiaryEnterprise': {
    flag: 'declarations.beneficiaryEnterprise.marked',
    member: 'declarations.beneficiaryEnterprise.noticeDate',
  },
  'declarations.specialYear': {
    flag: 'declarations.specialYear.marked',
    member: 'declarations.specialYear.balanceSheetDate',
  },
} as const;

/** Flag key → input path of the object it marks. */
const PRESENCE_FLAG_PATHS: ReadonlyMap<string, string> = new Map(
  Object.entries(PRESENCE_OBJECTS).map(([path, { flag }]) => [flag, path]),
);

/** Input path of the reportable positions; only the first five have a field (1000@1034–1046). */
export const REPORTABLE_POSITIONS = 'declarations.reportablePositions';

/** The header keys of the reportable positions, `declarations.reportablePositions[i]`. */
export const REPORTABLE_POSITION_KEYS = [0, 1, 2, 3, 4].map(
  index => `${REPORTABLE_POSITIONS}[${index}]`,
);

/** Header key of 2200@137, the 2000 code a 2200 record breaks down (SPEC §3.6). */
export const BREAKDOWN_CODE_KEY = 'code';

/** The key of the country of the `index`-th entry of a 2200 record in NormalizedRecord.paths. */
export function countryEntryKey(index: number): string {
  return `countries[${index}].country`;
}

/** The key of the income of the `index`-th entry of a 2200 record in NormalizedRecord.paths. */
export function incomeEntryKey(index: number): string {
  return `countries[${index}].income`;
}

/**
 * The `inputIndex` of pathFor for `record`: its index among records of its type, except for a 2200
 * record, whose input is keyed by the 2000 code it breaks down (0 when the record has none), and
 * for a capital-gains record, whose `inputIndex` (its index in `capitalGains`) is used when set.
 */
export function inputIndexOf(
  record: Pick<NormalizedRecord, 'recordType' | 'index' | 'inputIndex' | 'values'>,
): number {
  if (isCapitalGainsRecordType(record.recordType)) {
    return record.inputIndex ?? record.index;
  }
  if (record.recordType !== '2200') {
    return record.index;
  }
  const code = record.values[BREAKDOWN_CODE_KEY];
  return typeof code === 'number' ? code : 0;
}

/** The key of a code in NormalizedRecord.paths. */
export function codeKey(code: string): string {
  return CODE_KEY_PREFIX + code;
}

/**
 * The input path of a model key: a header key (FieldDef.key) or a code key (`code:${code}`) of the
 * record of type `recordType` produced from the `inputIndex`-th input element (0-based; 0 for
 * record 1000).
 *
 * - Record 1000: a header key is its own dotted input path (`company.phone.number`,
 *   `declarations.reportablePositions[2]`), except a presence flag, which maps to the object it
 *   marks (836 → `declarations.familyCompany`); a code maps to `amounts["018"]`.
 * - Record 1010: a header key maps to `relatedCompanies[i].<key>`.
 * - Record 1020: a header key maps to `shareholders[i].<key>`.
 * - Record 1030: a header key maps to `rdInvestments[i].<key>`.
 * - Record 2000 (at most one): a header key maps to `foreignAppendix.<key>`, a code to
 *   `foreignAppendix.amounts["420"]`. Nothing of record 2000 is derived.
 * - Record 2200: the input keys breakdowns by code, so `inputIndex` is the 2000 code the record
 *   breaks down (inputIndexOf gives it for a record). Its code (2200@137 `code`) maps to the
 *   breakdown itself, `foreignAppendix.countryBreakdown["420"]`; any other key, a header key or a
 *   country entry key (`countries[2].country`, `countries[2].income`), to
 *   `foreignAppendix.countryBreakdown["420"].<key>`.
 * - Records 3060, 3063, 3064, 3065, 3066: `inputIndex` is the index of the appendix in `capitalGains`
 *   (inputIndexOf gives it for a record); a header key maps to `capitalGains[i].<key>`
 *   (a withholder slot key too: `capitalGains[i].withholders[2].name`), a code to
 *   `capitalGains[i].amounts["022"]`.
 * - Derived values have no input path and map to `''` (report level): derived header keys
 *   (1000@832 `hasForeignAppendix`, 1010@137 and 1020@137 `serialNumber`, 1030@137
 *   `affiliation`, 30xx@137 `transactionSymbol`, 30xx@139 `appendixNumber` and the "מספר בתל"ם"
 *   `sequenceNumber` (3065@325, 3066@154)) and derived
 *   codes (SPEC §7.4: 008, 028, 273, 277, 278, 280, 297). A derived value whose key is itself an input property
 *   (1000@833 `declarations.hasCapitalGainsAppendix`) keeps that property's path.
 *   Every field of the control record 9999 is derived, so its keys map to `''` as well.
 * - Capital-gains records whose input is not modelled yet map to `''`, so the parser can report
 *   issues on them; steps G4–G5 replace this with their input paths.
 */
export function pathFor(recordType: RecordType, inputIndex: number, key: string): string {
  const isCode = key.startsWith(CODE_KEY_PREFIX);
  const code = key.slice(CODE_KEY_PREFIX.length);
  if (
    isCode ? DERIVED_CODES[recordType]?.includes(code) : DERIVED_KEYS[recordType]?.includes(key)
  ) {
    return '';
  }
  switch (recordType) {
    case '1000':
      return isCode ? `amounts["${code}"]` : (PRESENCE_FLAG_PATHS.get(key) ?? key);
    case '1010':
      return `relatedCompanies[${inputIndex}].${key}`;
    case '1020':
      return `shareholders[${inputIndex}].${key}`;
    case '1030':
      return `rdInvestments[${inputIndex}].${key}`;
    case '2000':
      return isCode ? `foreignAppendix.amounts["${code}"]` : `foreignAppendix.${key}`;
    case '2200': {
      const breakdown = `foreignAppendix.countryBreakdown["${String(inputIndex).padStart(3, '0')}"]`;
      return key === BREAKDOWN_CODE_KEY ? breakdown : `${breakdown}.${key}`;
    }
    case '3060':
    case '3063':
    case '3064':
    case '3065':
    case '3066':
      return isCode
        ? `capitalGains[${inputIndex}].amounts["${code}"]`
        : `capitalGains[${inputIndex}].${key}`;
    // No input mapping yet: replaced by steps G4–G5.
    case '3027':
    case '3050':
    case '3051':
    case '3054':
    case '3077':
      return '';
    // Control record: every field is derived (SPEC §7.4).
    case '9999':
      return '';
  }
}
