/**
 * Stage 2 of SPEC §9.2: code-map keys that are unknown or derived (input.unknownCode,
 * input.derivedCode), then the strict zod schema, whose issues become input.shape issues.
 */
import type { z } from 'zod';
import { Opcn1214InternalError } from '../errors.js';
import { capitalGainsRecordType } from '../layout/capital-gains.js';
import { getLayout } from '../layout/registry.js';
import type { CodeDef, RecordDef, YearLayout } from '../layout/types.js';
import type { SupportedTaxYear } from '../model/input.js';
import { schemaFor } from '../model/schema.js';
import {
  CAPITAL_GAINS_INPUT_KEYS,
  type CapitalGainsInputSymbol,
} from '../normalize/capital-gains/index.js';
import { IMPROVEMENT_SLOTS, improvementCode } from '../normalize/capital-gains/other.js';
import { DERIVED_MAIN_CODE_SOURCES } from '../normalize/derive.js';
import { makeIssue, type Issue } from './issue.js';

type ZodIssue = z.ZodError['issues'][number];

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A zod path in the SPEC §9.1 grammar: `a.b`, `a[0]`, `amounts["018"]`; '' for the root. */
function formatPath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      text += `[${segment}]`;
    } else {
      const key = String(segment);
      if (IDENTIFIER.test(key)) {
        text += text === '' ? key : `.${key}`;
      } else {
        text += `[${JSON.stringify(key)}]`;
      }
    }
  }
  return text;
}

/** Only defined primitive offending values are carried, never whole objects or arrays. */
function primitive(value: unknown): { value?: unknown } {
  return value === undefined || (typeof value === 'object' && value !== null) ? {} : { value };
}

function hasInput(issue: ZodIssue): issue is ZodIssue & { input: unknown } {
  return 'input' in issue;
}

function convert(issue: ZodIssue): Issue[] {
  if (issue.code === 'unrecognized_keys') {
    // One zod issue at the parent lists every unknown key: one input.shape issue per key.
    const parent: unknown = hasInput(issue) ? issue.input : undefined;
    return issue.keys.map(key =>
      makeIssue('input.shape', {
        message: `Unknown property ${JSON.stringify(key)}.`,
        path: formatPath([...issue.path, key]),
        ...(typeof parent === 'object' && parent !== null
          ? primitive((parent as Record<string, unknown>)[key])
          : {}),
      }),
    );
  }
  return [
    makeIssue('input.shape', {
      message: issue.message,
      path: formatPath(issue.path),
      ...(hasInput(issue) ? primitive(issue.input) : {}),
      ...(issue.code === 'invalid_type' ? { expected: issue.expected } : {}),
    }),
  ];
}

/**
 * The input.shape issues of a failed parse (SPEC §9.2), paths in the SPEC §9.1 grammar. Offending
 * values are carried when the parse ran with `reportInput: true`.
 */
export function zodIssuesToIssues(error: z.ZodError): Issue[] {
  return error.issues.flatMap(convert);
}

/** A code map of the input (`amounts`, …) and the record whose codes it holds. */
interface CodeMap {
  /** Input path of the map, e.g. `amounts`. */
  path: string;
  taxYear: number;
  record: RecordDef;
  /** 0-based index of the record among records of its type, when the map has one record. */
  recordIndex?: number;
  /** The keys the map accepts (default: the codes of `record`) and what they are, for messages. */
  codes?: { defs: readonly CodeDef[]; description: string };
  /** The input properties each derived code of the record comes from (SPEC §7.4). */
  derivedSources: Readonly<Partial<Record<string, readonly string[]>>>;
}

/** `{}` or `Object.create(null)`: what zod accepts as a record (not a Map, Date or class). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Checks the keys of the code map `value` against the codes of `map.record` (SPEC §9.2): a key that
 * is not a code of the record is input.unknownCode, a derived code is input.derivedCode naming the
 * input property that controls it. Returns those issues and the map without the reported keys, so
 * zod does not report them again; a value that is not a plain object (an array, a Map, a Date, a
 * class instance) is returned unchanged for zod, which reports it as input.shape.
 */
function scanCodeMap(value: unknown, map: CodeMap): { issues: Issue[]; value: unknown } {
  if (!isPlainObject(value)) {
    return { issues: [], value };
  }
  const accepted = map.codes ?? {
    defs: map.record.codes,
    description: `a code of record ${map.record.type}`,
  };
  const codes = new Map(accepted.defs.map(def => [def.code, def]));
  const issues: Issue[] = [];
  const kept: Record<string, unknown> = {};
  for (const [key, amount] of Object.entries(value)) {
    const def = codes.get(key);
    if (def && !def.derived) {
      kept[key] = amount;
      continue;
    }
    const details = {
      path: `${map.path}[${JSON.stringify(key)}]`,
      recordType: map.record.type,
      ...(map.recordIndex === undefined ? {} : { recordIndex: map.recordIndex }),
      code: key,
      ...primitive(amount),
    };
    if (def) {
      const sources = map.derivedSources[key];
      if (!sources) {
        throw new Opcn1214InternalError(`Derived code ${key} has no input source`);
      }
      issues.push(
        makeIssue('input.derivedCode', {
          ...details,
          message: `Code ${key} is derived from ${sources.join(' and ')} (SPEC §7.4); remove it from ${map.path}.`,
        }),
      );
    } else {
      // A number key ({ 18: … }) arrives as "18"; codes are 3-digit strings (SPEC §3.5).
      const padded = key.padStart(3, '0');
      const hint =
        padded !== key && codes.has(padded) ? ` Did you mean ${JSON.stringify(padded)}?` : '';
      issues.push(
        makeIssue('input.unknownCode', {
          ...details,
          message: `${JSON.stringify(key)} is not ${accepted.description} for tax year ${map.taxYear}.${hint}`,
        }),
      );
    }
  }
  return { issues, value: kept };
}

/** The foreign appendix and the capital-gains appendices but 3077 have no derived codes (§7.4). */
const NO_DERIVED_CODES: Readonly<Partial<Record<string, readonly string[]>>> = {};

/**
 * The input properties the derived codes of the appendix at `index` of `capitalGains` come from
 * (SPEC §7.4): 3077 codes 501–505 from the code-50 amounts of improvements 1–5.
 */
function capitalGainsDerivedSources(
  symbol: CapitalGainsInputSymbol,
  index: number,
): Readonly<Partial<Record<string, readonly string[]>>> {
  if (symbol !== 77) {
    return NO_DERIVED_CODES;
  }
  return Object.fromEntries(
    Array.from({ length: IMPROVEMENT_SLOTS }, (_, slot) => [
      improvementCode(slot),
      [`capitalGains[${index}].improvements[${slot}].code50Amount`],
    ]),
  );
}

/** True for a `symbol` the input model has an appendix type for (every capital-gains symbol). */
function isInputSymbol(symbol: unknown): symbol is CapitalGainsInputSymbol {
  return typeof symbol === 'number' && Object.hasOwn(CAPITAL_GAINS_INPUT_KEYS, symbol);
}

/**
 * The `amounts` of every capital-gains appendix of `appendices` scanned against the codes of its
 * record type (30xx = 3000 + symbol): their issues, located by the appendix's index among those of
 * its symbol, and a copy of `appendices` with the reported keys removed. Appendices that are not
 * plain objects or have no modelled symbol are left to zod.
 */
function scanCapitalGains(
  appendices: readonly unknown[],
  layout: YearLayout,
): { issues: Issue[]; value: unknown[] } {
  const perSymbol = new Map<CapitalGainsInputSymbol, number>();
  const issues: Issue[] = [];
  const value = appendices.map((appendix, index) => {
    if (!isPlainObject(appendix) || !isInputSymbol(appendix.symbol)) {
      return appendix;
    }
    const recordIndex = perSymbol.get(appendix.symbol) ?? 0;
    perSymbol.set(appendix.symbol, recordIndex + 1);
    const amounts = scanCodeMap(appendix.amounts, {
      path: `capitalGains[${index}].amounts`,
      taxYear: layout.taxYear,
      record: layout.records[capitalGainsRecordType(appendix.symbol)],
      recordIndex,
      derivedSources: capitalGainsDerivedSources(appendix.symbol, index),
    });
    issues.push(...amounts.issues);
    return { ...appendix, amounts: amounts.value };
  });
  return { issues, value };
}

/**
 * The code maps of `input` scanned (scanCodeMap): their issues, and a shallow copy of `input` with
 * the reported keys removed. Record 1000 `amounts` and, when `foreignAppendix` is an object, its
 * `amounts` (record 2000) and `countryBreakdown` (records 2200, keyed by the per-country codes of
 * record 2000), and the `amounts` of every capital-gains appendix (scanCapitalGains). Anything that
 * is not a plain object (or an array, for `capitalGains`) is left to zod.
 */
function scanCodeMaps(input: unknown, layout: YearLayout): { issues: Issue[]; input: unknown } {
  if (!isPlainObject(input)) {
    return { issues: [], input };
  }
  const amounts = scanCodeMap(input.amounts, {
    path: 'amounts',
    taxYear: layout.taxYear,
    record: layout.records['1000'],
    recordIndex: 0,
    derivedSources: DERIVED_MAIN_CODE_SOURCES,
  });
  const scanned: Record<string, unknown> = { ...input, amounts: amounts.value };
  const issues = [...amounts.issues];
  const appendix = input.foreignAppendix;
  if (isPlainObject(appendix)) {
    const foreign = scanCodeMap(appendix.amounts, {
      path: 'foreignAppendix.amounts',
      taxYear: layout.taxYear,
      record: layout.records['2000'],
      recordIndex: 0,
      derivedSources: NO_DERIVED_CODES,
    });
    issues.push(...foreign.issues);
    const scannedAppendix: Record<string, unknown> = { ...appendix, amounts: foreign.value };
    if (isPlainObject(appendix.countryBreakdown)) {
      // Keyed by the per-country codes of record 2000; none of them is derived.
      const breakdowns = scanCodeMap(appendix.countryBreakdown, {
        path: 'foreignAppendix.countryBreakdown',
        taxYear: layout.taxYear,
        record: layout.records['2200'],
        codes: {
          defs: layout.records['2000'].codes.filter(def => def.perCountryBreakdown),
          description: 'a per-country breakdown code of record 2000',
        },
        derivedSources: NO_DERIVED_CODES,
      });
      issues.push(...breakdowns.issues);
      scannedAppendix.countryBreakdown = breakdowns.value;
    }
    scanned.foreignAppendix = scannedAppendix;
  }
  if (Array.isArray(input.capitalGains)) {
    const appendices = scanCapitalGains(input.capitalGains, layout);
    issues.push(...appendices.issues);
    scanned.capitalGains = appendices.value;
  }
  return { issues, input: scanned };
}

/**
 * The shape stage (SPEC §9.2 stage 2) of `input` of a supported `taxYear`: the
 * input.unknownCode / input.derivedCode issues of its code maps, then the input.shape issues of the
 * year's strict schema run on the input without the reported code keys. Offending values are
 * carried. `input` is not changed.
 */
export function checkShape(input: unknown, taxYear: SupportedTaxYear): Issue[] {
  const scanned = scanCodeMaps(input, getLayout(taxYear));
  const shape = schemaFor(taxYear).safeParse(scanned.input, { reportInput: true });
  return shape.success ? scanned.issues : [...scanned.issues, ...zodIssuesToIssues(shape.error)];
}
