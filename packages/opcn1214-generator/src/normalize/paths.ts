/**
 * Input paths of model keys (SPEC §7.3, §9.1 path grammar). Shared by the normalizer, which fills
 * NormalizedRecord.paths, and the parser, which reports issues against the reconstructed input.
 */
import type { RecordType } from '../layout/types.js';
import { DERIVED_MAIN_CODES } from '../model/codes.generated.js';

/** Prefix of code-amount keys in NormalizedRecord.paths: `code:${code}`. */
const CODE_KEY_PREFIX = 'code:';

/** Derived header keys (`(derived) ` rows of fields.csv) of the records mapped here. */
const DERIVED_KEYS: Readonly<Partial<Record<RecordType, readonly string[]>>> = {
  '1000': ['hasForeignAppendix'],
  '1010': ['serialNumber'],
  '1020': ['serialNumber'],
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
 * - Derived values have no input path and map to `''` (report level): derived header keys
 *   (1000@832 `hasForeignAppendix`, 1010@137 and 1020@137 `serialNumber`) and derived codes (SPEC §7.4: 008,
 *   028, 273, 277, 278, 280, 297). A derived value whose key is itself an input property
 *   (1000@833 `declarations.hasCapitalGainsAppendix`) keeps that property's path.
 *   Every field of the control record 9999 is derived, so its keys map to `''` as well.
 * - Records whose input is not modelled yet (1030, 2000, 2200, 30xx) map to `''`, so the parser
 *   can report issues on them; steps E2 (1030), F1 (2000), F2 (2200) and G1–G5 (30xx) replace
 *   this with their input paths.
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
    // No input mapping yet: replaced by steps E2, F1, F2 and G1–G5.
    case '1030':
    case '2000':
    case '2200':
    case '3027':
    case '3050':
    case '3051':
    case '3054':
    case '3060':
    case '3063':
    case '3064':
    case '3065':
    case '3066':
    case '3077':
      return '';
    // Control record: every field is derived (SPEC §7.4).
    case '9999':
      return '';
  }
}
