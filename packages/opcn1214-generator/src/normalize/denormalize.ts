/**
 * Denormalizer (IMPLEMENTATION_PLAN.md §1.1): turns a NormalizedReport back into the public
 * Report1214Input, in canonical form (SPEC §8.4). Covers the input model as it exists: record 1000
 * (meta, company, preparer, declarations, bank account, amounts) and records 1010 and 1020.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { BANK_ACCOUNT_DIGITS, CODE_297_VALUES, type BankAccount } from './derive.js';
import { ENUM_INPUTS, enumLiteral, RELATION_TYPE_CODES } from './enums.js';
import { PRESENCE_OBJECTS, REPORTABLE_POSITION_KEYS, REPORTABLE_POSITIONS } from './paths.js';

/**
 * Header keys of record 1000 that are their own input path (SPEC §7.3); the enum keys hold their
 * code in the model (ENUM_INPUTS). Not listed: `taxYear`, the derived keys (832
 * `hasForeignAppendix`, 833 `declarations.hasCapitalGainsAppendix`), the declaration objects
 * marked by a presence flag (PRESENCE_OBJECTS) and the reportable positions.
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
  'preparer.officeName',
  'preparer.contactName',
  'preparer.name',
  'preparer.profession',
  'preparer.licensedDealerNumber',
  'preparer.address',
  'preparer.phone.prefix',
  'preparer.phone.number',
  'declarations.form6111Obligation',
  'declarations.financialStatementsAttached',
  'declarations.isHouseCompany',
  'declarations.form1343Attached',
  'declarations.form1344Attached',
  'declarations.claimsCapitalInvestmentLawBenefits',
  'declarations.preferredEnterprise',
  'declarations.dividendDistributed',
  'declarations.foreignInvestors',
  'declarations.consolidatedReport',
  'declarations.partnerInPartnership',
  'declarations.isKibbutz',
  'declarations.hasTaxPlanningAction',
  'declarations.hadRelatedPartyTransactions',
  'declarations.controlsBodyOfPersons',
  'declarations.holdsRightsInBodyOfPersons',
  'declarations.appliesAccountingStandards',
  'declarations.requestsAdvancePayments',
  'declarations.hasBuildingIncome',
  'declarations.isTrustBeneficiary',
  'declarations.directorsReceivedOpinion',
  'declarations.tookReportablePosition',
  'declarations.nonDeductibleSalaryExpenses',
  'declarations.fewMembersCompany62A',
  'declarations.partOfMultinationalGroup',
  'declarations.noBankAccount',
  'otherTaxableIncome.source',
  'otherTaxableIncome.amount',
  'otherTaxableIncome.ratePercent',
  'attachments.donationReceiptsCount',
  'attachments.withholdingCertificatesCount',
  'capitalGainsSummary.totalAppendicesCount',
  'capitalGainsSummary.untransmittedCount',
  'capitalGainsSummary.reasons.lossOrNoGain',
  'capitalGainsSummary.reasons.overFiveImprovementBalances',
  'capitalGainsSummary.reasons.over14Appendices',
  'capitalGainsSummary.reasons.other',
  'capitalGainsSummary.reasons.otherText',
  'qualifyingCompany.purchased',
  'qualifyingCompany.israeliPurchaseAmount',
  'qualifyingCompany.foreignPurchaseAmount',
  'qualifyingCompany.amortizationClaimed',
  'qualifyingCompany.amortizationAmount',
] as const;

/** Header keys of record 1010 that are properties of a related company (`serialNumber` is derived). */
export const RELATED_COMPANY_INPUT_KEYS = [
  'companyName',
  'companyFileNumber',
  'relationType',
  'assessingOfficeCode',
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

/** A value set into an input tree: a model value, an object or an array of model values. */
export type InputValue = Primitive | InputTree | Primitive[];

/**
 * Sets the dotted `key` (`company.phone.prefix`) of `target` to `value`, creating the objects on
 * the way. An undefined value is not set, so absent values leave no (empty) object behind.
 */
export function setKey(target: InputTree, key: string, value: InputValue): void {
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

function relatedCompany(record: NormalizedRecord): InputTree {
  const tree: InputTree = {};
  for (const key of RELATED_COMPANY_INPUT_KEYS) {
    const value = record.values[key];
    setKey(tree, key, key === 'relationType' ? enumLiteral(RELATION_TYPE_CODES, value) : value);
  }
  return tree;
}

function shareholder(record: NormalizedRecord): InputTree {
  const tree: InputTree = {};
  for (const key of SHAREHOLDER_INPUT_KEYS) {
    setKey(tree, key, record.values[key]);
  }
  return tree;
}

/** Codes derived from `bankAccount` (SPEC §7.4). */
const BANK_CODES = ['277', '278', '280'] as const;

/**
 * The bankAccount of the codes 277/278/280 (SPEC §7.4): present when any of them is; 278 is bank
 * (2 digits) then branch (3 digits), 277 the account padded to 9 digits. A code written as absent
 * (0) reads as zeros.
 */
function bankAccount(codes: ReadonlyMap<string, number>): BankAccount | undefined {
  if (!BANK_CODES.some(code => codes.has(code))) {
    return undefined;
  }
  const bankBranch = String(codes.get('278') ?? 0).padStart(5, '0');
  return {
    bank: bankBranch.slice(0, 2),
    branch: bankBranch.slice(2),
    account: String(codes.get('277') ?? 0).padStart(BANK_ACCOUNT_DIGITS, '0'),
  };
}

/**
 * form6111Obligation of code 297 (8 obliged, 9 not obliged), read only when 834 is absent: 834 is
 * the source of truth (a mismatch is parse.derivedMismatch, step H1).
 */
function form6111ObligationOf297(main: NormalizedRecord): string | undefined {
  if (main.values['declarations.form6111Obligation'] !== undefined) {
    return undefined;
  }
  const code = main.codes.get('297');
  return Object.entries(CODE_297_VALUES).find(([, value]) => value === code)?.[0];
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
  const related = report.records.filter(record => record.recordType === '1010');
  if (related.length > 0) {
    output.relatedCompanies = related.map(relatedCompany);
  }
  for (const key of MAIN_INPUT_KEYS) {
    const value = main.values[key];
    const codes = ENUM_INPUTS[key];
    setKey(output, key, codes ? enumLiteral(codes, value) : value);
  }
  setKey(output, 'declarations.form6111Obligation', form6111ObligationOf297(main));
  setKey(output, 'bankAccount', bankAccount(main.codes));
  // A declaration object exists when its flag is marked (SPEC §7.3).
  for (const [object, { flag, member }] of Object.entries(PRESENCE_OBJECTS)) {
    if (main.values[flag] === true) {
      setKey(output, object, {});
      setKey(output, member, main.values[member]);
    }
  }
  const positions = REPORTABLE_POSITION_KEYS.map(key => main.values[key]).filter(
    value => value !== undefined,
  );
  if (positions.length > 0) {
    setKey(output, REPORTABLE_POSITIONS, positions);
  }
  // 833 = yes is read back as hasCapitalGainsAppendix only when untransmitted appendices do not
  // already explain it (SPEC §7.3, §7.4); the model has no capital-gains appendices yet (G1).
  const untransmitted = main.values['capitalGainsSummary.untransmittedCount'];
  if (
    main.values['declarations.hasCapitalGainsAppendix'] === true &&
    !(typeof untransmitted === 'number' && untransmitted > 0)
  ) {
    setKey(output, 'declarations.hasCapitalGainsAppendix', true);
  }
  // The tree has the members of Report1214Input; values are typed by their layout kinds.
  return output as unknown as Report1214Input;
}
