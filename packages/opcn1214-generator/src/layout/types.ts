/**
 * Layout types (SPEC §5.4). The runtime layout of each tax year is generated from
 * documentation/layout/<year>/*.csv into src/layout/<year>/layout.generated.ts.
 */

export type RecordType =
  | '1000'
  | '1010'
  | '1020'
  | '1030'
  | '2000'
  | '2200'
  | '3027'
  | '3050'
  | '3051'
  | '3054'
  | '3060'
  | '3063'
  | '3064'
  | '3065'
  | '3066'
  | '3077'
  | '9999';

/** Semantic kinds of header fields (SPEC §4.2). */
export const FIELD_KINDS = [
  'text',
  'hebrewText',
  'id9',
  'shareholderId',
  'year',
  'num',
  'digits',
  'amount',
  'amountX',
  'amountX100',
  'rateX100',
  'percentX100',
  'percentLiteral',
  'date',
  'flag',
  'yesNo',
  'enum',
  'phonePrefix',
  'foreignCode',
  'serial',
  'count',
  'const',
  'filler',
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

/** Kinds of code-amount section values (SPEC §3.5). */
export const CODE_KINDS = ['amount', 'amountX100', 'rateX100', 'enum', 'num'] as const;

export type CodeKind = (typeof CODE_KINDS)[number];

export type Requirement = 'yes' | 'no' | 'conditional';

export interface EnumValue {
  readonly value: number;
  readonly label?: string;
}

export interface FieldDef {
  readonly record: RecordType;
  /** 1-based start position. */
  readonly position: number;
  readonly length: number;
  readonly type: 'numeric' | 'alphanumeric';
  readonly required: Requirement;
  /** Canonical key, without the `(derived) ` prefix of the CSV. */
  readonly key: string;
  /** True for rows whose CSV key starts with `(derived) ` (computed by the package, SPEC §7.4). */
  readonly derived: boolean;
  readonly kind: FieldKind;
  readonly values?: readonly EnumValue[];
  readonly nameHe: string;
  readonly specPage: number;
}

export interface CodeDef {
  readonly record: RecordType;
  /** 3 digits. */
  readonly code: string;
  readonly length: number;
  readonly required: Requirement;
  readonly kind: CodeKind;
  readonly values?: readonly EnumValue[];
  readonly zeroAllowed: boolean;
  readonly perCountryBreakdown: boolean;
  readonly derived: boolean;
  readonly notesHe: string;
  readonly specPage: number;
}

export interface RecordDef {
  readonly type: RecordType;
  /** Canonical order within a report (SPEC §3.3). */
  readonly order: number;
  readonly length: number;
  readonly headerLength: number;
  readonly section?: {
    readonly kind: 'codeAmount' | 'countryAmount';
    readonly start: number;
    readonly length: number;
    /** Maximum entries: 1000 → 61 (p.13); 2200 → 10 (p.31); other records → their number of codes. */
    readonly maxEntries: number;
  };
  readonly minOccurs: number;
  readonly maxOccurs: number;
  /** Sorted by position, contiguous from 137 to the end of the header. */
  readonly fields: readonly FieldDef[];
  readonly codes: readonly CodeDef[];
}

export interface YearLayout {
  readonly taxYear: number;
  readonly records: Readonly<Record<RecordType, RecordDef>>;
  /** Country code (3 digits, or `-88`; see `countryKey`) → Hebrew name (record 2200). */
  readonly countries: ReadonlyMap<string, string>;
  /** Fixed limits of the 1214 file (SPEC §3.1, §3.5–§3.7). */
  readonly limits: {
    /** Reports per OPCN file. */
    readonly reportsPerFile: 50;
    /** Capital-gains appendices (30xx records) per report, all symbols together. */
    readonly capitalGainsAppendices: 14;
    /** Code-amount entries in record 1000. */
    readonly mainCodePairs: 61;
    /** Country entries in one 2200 record. */
    readonly countriesPerRecord: 10;
  };
}
