/**
 * Denormalizer (IMPLEMENTATION_PLAN.md §1.1): turns a NormalizedReport back into the public
 * Report1214Input, in canonical form (SPEC §8.4). Covers the input model as it exists: record 1000
 * (meta, company, declarations, amounts) and records 1020.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';

/**
 * Header keys of record 1000 that are their own input path (SPEC §7.3). `taxYear` and the derived
 * keys (832 `hasForeignAppendix`, 833 `declarations.hasCapitalGainsAppendix`) are not input.
 */
export const MAIN_INPUT_KEYS = [
  'meta.softwareName',
  'meta.saveDate',
  'company.fileNumber',
  'company.registeredName',
  'company.withholdingFileNumber',
  'company.vatFileNumber',
  'company.occupationDescription',
  'company.mailingAddress',
  'company.businessAddress',
  'company.booksAddress',
  'company.email',
  'company.phone.prefix',
  'company.phone.number',
  'company.fax.prefix',
  'company.fax.number',
  'declarations.hasTaxPlanningAction',
  'declarations.hadRelatedPartyTransactions',
  'declarations.controlsBodyOfPersons',
  'declarations.holdsRightsInBodyOfPersons',
  'declarations.appliesAccountingStandards',
  'declarations.directorsReceivedOpinion',
  'declarations.tookReportablePosition',
] as const;

/** Header keys of record 1020 that are properties of a shareholder (`serialNumber` is derived). */
export const SHAREHOLDER_INPUT_KEYS = [
  'idNumber',
  'fullName',
  'isControllingShareholder',
  'dividendRightsPercent',
  'votingRightsPercent',
  'otherRightsPercent',
  'isMaterialShareholder',
  'salaryMonths1To9',
  'salaryMonths10To12',
  'otherPayments',
] as const;

/** An input object under construction. */
export type InputTree = Record<string, unknown>;

/**
 * Sets the dotted `key` (`company.phone.prefix`) of `target` to `value`, creating the objects on
 * the way. An undefined value is not set, so absent values leave no (empty) object behind.
 */
export function setKey(target: InputTree, key: string, value: Primitive): void {
  if (value === undefined) {
    return;
  }
  const segments = key.split('.');
  const last = segments.pop();
  if (last === undefined) {
    throw new Opcn1214InternalError(`Empty input key`);
  }
  let node = target;
  for (const segment of segments) {
    const child = node[segment];
    if (typeof child === 'object' && child !== null) {
      node = child as InputTree;
    } else {
      const created: InputTree = {};
      node[segment] = created;
      node = created;
    }
  }
  node[last] = value;
}

function shareholder(record: NormalizedRecord): InputTree {
  const tree: InputTree = {};
  for (const key of SHAREHOLDER_INPUT_KEYS) {
    setKey(tree, key, record.values[key]);
  }
  return tree;
}

/**
 * The Report1214Input of `report`, in canonical form: absent values are left out (a required
 * value missing from a parsed file included; its field.required issue reports it), derived values
 * are dropped (header keys and codes). Throws Opcn1214InternalError for a report without record
 * 1000.
 */
export function denormalize(report: NormalizedReport): Report1214Input {
  const main = report.records.find(record => record.recordType === '1000');
  if (!main) {
    throw new Opcn1214InternalError('A report has no record 1000');
  }
  const derivedCodes = new Set(
    report.layout.records['1000'].codes.filter(code => code.derived).map(code => code.code),
  );
  const amounts: Record<string, number> = {};
  for (const [code, value] of main.codes) {
    if (!derivedCodes.has(code)) {
      amounts[code] = value;
    }
  }
  const output: InputTree = {
    taxYear: report.taxYear,
    company: {},
    declarations: {},
    amounts,
    shareholders: report.records.filter(record => record.recordType === '1020').map(shareholder),
  };
  for (const key of MAIN_INPUT_KEYS) {
    setKey(output, key, main.values[key]);
  }
  // The tree has the members of Report1214Input; values are typed by their layout kinds.
  return output as unknown as Report1214Input;
}
