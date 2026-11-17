import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { countryKey } from '../../src/layout/countries.js';
import { CODE_KINDS, FIELD_KINDS, type CodeKind, type FieldKind } from '../../src/layout/types.js';
import type { CsvRow } from './csv.js';
import { DERIVED_CODES } from './derived-codes.js';
import { codesModuleUrl, layoutModuleUrl, type LayoutSources } from './sources.js';
import { parseValues } from './values.js';

const DERIVED_PREFIX = '(derived) ';

/** YearLayout.limits (SPEC §3.1, §3.5–§3.7); the same for every tax year so far. */
const LIMITS = {
  reportsPerFile: 50,
  capitalGainsAppendices: 14,
  mainCodePairs: 61,
  countriesPerRecord: 10,
} as const;

/** Section entry limits fixed by the spec; every other section holds at most one entry per code. */
const SECTION_MAX_ENTRIES: Readonly<Record<string, number>> = {
  '1000': LIMITS.mainCodePairs,
  '2200': LIMITS.countriesPerRecord,
};

function column(row: CsvRow, name: string): string {
  const value = row[name];
  if (value === undefined) {
    throw new Error(`layout CSV: missing column "${name}"`);
  }
  return value;
}

function integer(row: CsvRow, name: string): number {
  const value = column(row, name);
  if (!/^\d+$/.test(value)) {
    throw new Error(`layout CSV: column "${name}" must be a non-negative integer, got "${value}"`);
  }
  return Number(value);
}

function oneOf<T extends string>(row: CsvRow, name: string, allowed: readonly T[]): T {
  const value = column(row, name);
  const match = allowed.find(candidate => candidate === value);
  if (match === undefined) {
    throw new Error(
      `layout CSV: column "${name}" must be one of ${allowed.join(', ')}, got "${value}"`,
    );
  }
  return match;
}

function yesNo(row: CsvRow, name: string): boolean {
  return oneOf(row, name, ['yes', 'no']) === 'yes';
}

interface CodeData {
  record: string;
  code: string;
  derived: boolean;
  perCountryBreakdown: boolean;
  notesHe: string;
  /** The CodeDef literal emitted into the layout module. */
  def: Record<string, unknown>;
}

function toCode(row: CsvRow): CodeData {
  const record = column(row, 'record');
  const code = column(row, 'code');
  if (!/^\d{3}$/.test(code)) {
    throw new Error(`codes.csv: code "${code}" of record ${record} must have 3 digits`);
  }
  const length = integer(row, 'length');
  if (length < 1 || length > 12) {
    throw new Error(`codes.csv: code ${record}:${code} must be 1–12 wide, got ${length}`);
  }
  const values = parseValues(column(row, 'values'));
  const derived = DERIVED_CODES[record]?.includes(code) ?? false;
  const perCountryBreakdown = yesNo(row, 'perCountryBreakdown');
  const notesHe = column(row, 'notesHe');
  return {
    record,
    code,
    derived,
    perCountryBreakdown,
    notesHe,
    def: {
      record,
      code,
      length,
      required: oneOf(row, 'required', ['yes', 'no', 'conditional']),
      kind: oneOf<CodeKind>(row, 'kind', CODE_KINDS),
      ...(values ? { values } : {}),
      zeroAllowed: yesNo(row, 'zeroAllowed'),
      perCountryBreakdown,
      derived,
      notesHe,
      specPage: integer(row, 'specPage'),
    },
  };
}

/**
 * Parses codes.csv into the codes of each record, sorted by code. Every code must belong to a
 * record with a code-amount section, codes are unique per record, and every derived code of
 * scripts/layout/derived-codes.ts must exist.
 */
function codesByRecord(sources: LayoutSources): Map<string, CodeData[]> {
  const codeAmountRecords = new Set(
    sources.records
      .filter(row => column(row, 'sectionKind') === 'codeAmount')
      .map(row => column(row, 'record')),
  );
  const result = new Map<string, CodeData[]>();
  for (const row of sources.codes) {
    const code = toCode(row);
    if (!codeAmountRecords.has(code.record)) {
      throw new Error(`codes.csv: record "${code.record}" has no code-amount section`);
    }
    const codes = result.get(code.record) ?? [];
    if (codes.some(existing => existing.code === code.code)) {
      throw new Error(`codes.csv: duplicate code ${code.record}:${code.code}`);
    }
    codes.push(code);
    result.set(code.record, codes);
  }
  for (const [record, derived] of Object.entries(DERIVED_CODES)) {
    for (const code of derived) {
      if (!result.get(record)?.some(existing => existing.code === code)) {
        throw new Error(`derived-codes: ${record}:${code} is not in codes.csv`);
      }
    }
  }
  for (const codes of result.values()) {
    codes.sort((a, b) => a.code.localeCompare(b.code));
  }
  return result;
}

/** Parses countries.csv into [key, Hebrew name] pairs, in file order (keys via `countryKey`). */
function countryEntries(sources: LayoutSources): Array<[string, string]> {
  const entries = sources.countries.map((row): [string, string] => {
    const code = column(row, 'code');
    if (code !== '-88' && !/^\d{1,3}$/.test(code)) {
      throw new Error(`countries.csv: invalid country code "${code}"`);
    }
    return [countryKey(code), column(row, 'nameHe')];
  });
  const keys = new Set(entries.map(([key]) => key));
  if (keys.size !== entries.length) {
    throw new Error('countries.csv: duplicate country codes');
  }
  return entries;
}

function toField(row: CsvRow): Record<string, unknown> {
  const csvKey = column(row, 'key');
  const derived = csvKey.startsWith(DERIVED_PREFIX);
  const values = parseValues(column(row, 'values'));
  return {
    record: column(row, 'record'),
    position: integer(row, 'position'),
    length: integer(row, 'length'),
    type: oneOf(row, 'type', ['numeric', 'alphanumeric']),
    required: oneOf(row, 'required', ['yes', 'no', 'conditional']),
    key: derived ? csvKey.slice(DERIVED_PREFIX.length) : csvKey,
    derived,
    kind: oneOf<FieldKind>(row, 'kind', FIELD_KINDS),
    ...(values ? { values } : {}),
    nameHe: column(row, 'nameHe'),
    specPage: integer(row, 'specPage'),
  };
}

function toRecord(
  row: CsvRow,
  fieldRows: readonly CsvRow[],
  codes: readonly CodeData[],
): Record<string, unknown> {
  const type = column(row, 'record');
  const sectionKind = column(row, 'sectionKind');
  const fields = fieldRows
    .filter(field => column(field, 'record') === type)
    .map(toField)
    .sort((a, b) => Number(a['position']) - Number(b['position']));
  return {
    type,
    order: integer(row, 'order'),
    length: integer(row, 'length'),
    headerLength: integer(row, 'headerLength'),
    ...(sectionKind === ''
      ? {}
      : {
          section: {
            kind: oneOf(row, 'sectionKind', ['codeAmount', 'countryAmount']),
            start: integer(row, 'sectionStart'),
            length: integer(row, 'sectionLength'),
            maxEntries: SECTION_MAX_ENTRIES[type] ?? codes.length,
          },
        }),
    minOccurs: integer(row, 'minOccurs'),
    maxOccurs: integer(row, 'maxOccurs'),
    fields,
    codes: codes.map(code => code.def),
  };
}

/** Serializes plain data (objects, arrays, strings, numbers, booleans) as a TS literal. */
function toLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(toLiteral).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}:${toLiteral(item)}`,
    );
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  throw new Error(`layout render: cannot serialize ${String(value)}`);
}

/**
 * Renders src/layout/<year>/layout.generated.ts from the parsed CSVs of
 * documentation/layout/<year>/, formatted with the repository's prettier configuration.
 */
export async function renderLayoutModule(year: number, sources: LayoutSources): Promise<string> {
  const recordTypes = new Set(sources.records.map(row => column(row, 'record')));
  for (const field of sources.fields) {
    if (!recordTypes.has(column(field, 'record'))) {
      throw new Error(`layout CSV: field of unknown record "${column(field, 'record')}"`);
    }
  }
  const codes = codesByRecord(sources);
  const records = Object.fromEntries(
    [...sources.records]
      .sort((a, b) => integer(a, 'order') - integer(b, 'order'))
      .map(row => {
        const type = column(row, 'record');
        return [type, toRecord(row, sources.fields, codes.get(type) ?? [])];
      }),
  );

  const source = `// Generated by scripts/generate-layout.ts from documentation/layout/${year}/ — do not edit.
/* eslint-disable */
import type { YearLayout } from '../types.js';

export const LAYOUT_${year} = {
  taxYear: ${year},
  records: ${toLiteral(records)},
  countries: new Map<string, string>(${toLiteral(countryEntries(sources))}),
  limits: ${toLiteral(LIMITS)},
} as const satisfies YearLayout;
`;

  return formatModule(source, layoutModuleUrl(year));
}

async function formatModule(source: string, target: URL): Promise<string> {
  const filepath = fileURLToPath(target);
  const options = await resolveConfig(filepath);
  return format(source, { ...options, filepath });
}

/** A one-line JSDoc comment, or nothing for an empty text. */
function jsDoc(text: string): string {
  const line = text.replaceAll(/\s+/g, ' ').trim().replaceAll('*/', '*\\/');
  return line === '' ? '' : `/** ${line} */ `;
}

/** A literal union of string codes, each preceded by its JSDoc note. */
function codeUnion(entries: ReadonlyArray<{ code: string; note: string }>): string {
  return entries.map(({ code, note }) => `| ${jsDoc(note)}${JSON.stringify(code)}`).join('\n');
}

function codeArray(codes: readonly string[]): string {
  return `[${codes.map(code => JSON.stringify(code)).join(',')}]`;
}

/**
 * Renders src/model/codes.generated.ts: the year-independent literal unions of codes (SPEC §5.3,
 * §7.2) and matching `as const` arrays, generated from the newest layout year.
 */
export async function renderCodesModule(year: number, sources: LayoutSources): Promise<string> {
  const codes = codesByRecord(sources);
  const of = (record: string, predicate: (code: CodeData) => boolean = () => true) =>
    (codes.get(record) ?? []).filter(predicate);
  const withNotes = (list: readonly CodeData[]) =>
    list.map(code => ({ code: code.code, note: code.notesHe }));
  const main = of('1000');
  const derivedMain = of('1000', code => code.derived);
  const inputMain = of('1000', code => !code.derived);
  const foreign = of('2000');
  const breakdown = of('2000', code => code.perCountryBreakdown);
  const symbols = sources.records
    .map(row => column(row, 'record'))
    .filter(type => /^30\d{2}$/.test(type))
    .map(type => Number(type.slice(2)))
    .sort((a, b) => a - b);
  const countries = countryEntries(sources);

  const source = `// Generated by scripts/generate-layout.ts from documentation/layout/${year}/ — do not edit.
/* eslint-disable */

/** Codes of the record 1000 code-amount section (main form, SPEC §3.5). */
export type MainFormCode = ${codeUnion(withNotes(main))};

/** Main-form codes the package derives (SPEC §7.4); never passed by the caller. */
export type DerivedMainCode = ${codeUnion(withNotes(derivedMain))};

/** Main-form codes the caller may pass in \`amounts\`. */
export type MainFormInputCode = Exclude<MainFormCode, DerivedMainCode>;

/** Codes of the record 2000 code-amount section (foreign appendix). */
export type ForeignAppendixCode = ${codeUnion(withNotes(foreign))};

/** Foreign-appendix codes that require a per-country breakdown (record 2200, SPEC §3.6). */
export type CountryBreakdownCode = ${codeUnion(withNotes(breakdown))};

/** Transaction symbols of the capital-gains appendices (record 30xx = symbol xx). */
export type CapitalGainsSymbol = ${symbols.join(' | ')};

interface CapitalGainsCodeMap {
${symbols.map(symbol => `${symbol}: ${codeUnion(withNotes(of(`30${symbol}`)))};`).join('\n')}
}

/** Codes of the code-amount section of the capital-gains appendix of a symbol. */
export type CapitalGainsCode<S extends CapitalGainsSymbol> = CapitalGainsCodeMap[S];

/** Country codes of record 2200 (SPEC §3.6); \`-88\` = country unknown. */
export type CountryCode = ${codeUnion(countries.map(([code, name]) => ({ code, note: name })))};

export const MAIN_FORM_CODES = ${codeArray(main.map(code => code.code))} as const satisfies readonly MainFormCode[];

export const DERIVED_MAIN_CODES = ${codeArray(derivedMain.map(code => code.code))} as const satisfies readonly DerivedMainCode[];

export const MAIN_FORM_INPUT_CODES = ${codeArray(inputMain.map(code => code.code))} as const satisfies readonly MainFormInputCode[];

export const FOREIGN_APPENDIX_CODES = ${codeArray(foreign.map(code => code.code))} as const satisfies readonly ForeignAppendixCode[];

export const COUNTRY_BREAKDOWN_CODES = ${codeArray(breakdown.map(code => code.code))} as const satisfies readonly CountryBreakdownCode[];

export const CAPITAL_GAINS_SYMBOLS = [${symbols.join(',')}] as const satisfies readonly CapitalGainsSymbol[];

export const CAPITAL_GAINS_CODES = {
${symbols.map(symbol => `${symbol}: ${codeArray(of(`30${symbol}`).map(code => code.code))},`).join('\n')}
} as const satisfies { readonly [S in CapitalGainsSymbol]: readonly CapitalGainsCode<S>[] };

export const COUNTRY_CODES = ${codeArray(countries.map(([code]) => code))} as const satisfies readonly CountryCode[];
`;

  return formatModule(source, codesModuleUrl());
}
