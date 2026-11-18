/**
 * Denormalizer (IMPLEMENTATION_PLAN.md §1.1): turns a NormalizedReport back into the public
 * Report1214Input, in canonical form (SPEC §8.4). Covers the input model as it exists: record 1000
 * (meta, company, preparer, declarations, bank account, amounts) and records 1010, 1020, 1030,
 * 2000, 2200 and the capital-gains records of all ten appendix types (3027 … 3077).
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { isCapitalGainsRecordType } from '../layout/capital-gains.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { readWalletAddresses, walletAddressKey } from './capital-gains/assets.js';
import {
  CAPITAL_GAINS_INPUT_KEYS,
  hasWalletAddresses,
  hasWithholders,
  type CapitalGainsInputSymbol,
} from './capital-gains/index.js';
import {
  improvementCode,
  improvementKey,
  improvementSlotOfCode,
  readImprovements,
} from './capital-gains/other.js';
import { readWithholders, withholderKey } from './capital-gains/securities.js';
import { BANK_ACCOUNT_DIGITS, CODE_297_VALUES, type BankAccount } from './derive.js';
import {
  CAPITAL_GAINS_ENUM_INPUTS,
  ENUM_INPUTS,
  enumLiteral,
  RELATION_TYPE_CODES,
} from './enums.js';
import {
  inputIndexOf,
  PRESENCE_OBJECTS,
  REPORTABLE_POSITION_KEYS,
  REPORTABLE_POSITIONS,
} from './paths.js';

/**
 * Header keys of record 1000 that are their own input path (SPEC §7.3); the enum keys hold their
 * code in the model (ENUM_INPUTS). Not listed: `taxYear`, the derived keys (832
 * `hasForeignAppendix`, read back from the presence of record 2000; 833 `declarations.hasCapitalGainsAppendix`), the declaration objects
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

/** Header keys of record 1030 that are properties of an R&D investment (`affiliation` is derived). */
export const RD_INVESTMENT_INPUT_KEYS = [
  'companyName',
  'companyFileNumber',
  'investmentAmount',
] as const;

/** Header keys of record 2000, the members of the foreign appendix besides `amounts`. */
export const FOREIGN_APPENDIX_INPUT_KEYS = [
  'otherTaxableIncomeDescription',
  'otherTaxableIncome',
  'foreignTaxPaidOnOtherIncome',
  'totalForeignTaxableIncome',
  'totalForeignLoss',
  'participationExemptionHoldingCompany',
  'taxRefundDeclaration',
  'taxRefundDeclarationAmount',
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

function rdInvestment(record: NormalizedRecord): InputTree {
  const tree: InputTree = {};
  for (const key of RD_INVESTMENT_INPUT_KEYS) {
    setKey(tree, key, record.values[key]);
  }
  return tree;
}

/** Header keys of record 2200 that are members of a breakdown (2200@137 is its key). */
export const COUNTRY_BREAKDOWN_INPUT_KEYS = ['deductionsOffsetsAndExemptions'] as const;

function countryBreakdown(record: NormalizedRecord): InputTree {
  const tree: InputTree = {};
  for (const key of COUNTRY_BREAKDOWN_INPUT_KEYS) {
    setKey(tree, key, record.values[key]);
  }
  // The affiliation of every entry is derived (SPEC §7.4).
  tree.countries = record.countries.map(({ country, income }) => ({ country, income }));
  return tree;
}

/**
 * The foreign appendix of the 2000 `record`, with the 2200 `breakdowns` keyed by the 3-digit code
 * each one breaks down (2200@137); no `countryBreakdown` without 2200 records.
 */
function foreignAppendix(
  record: NormalizedRecord,
  breakdowns: readonly NormalizedRecord[],
): InputTree {
  const tree: InputTree = {};
  for (const key of FOREIGN_APPENDIX_INPUT_KEYS) {
    setKey(tree, key, record.values[key]);
  }
  // No code of record 2000 is derived (SPEC §7.4).
  tree.amounts = Object.fromEntries(record.codes);
  if (breakdowns.length > 0) {
    tree.countryBreakdown = Object.fromEntries(
      breakdowns.map(breakdown => [
        String(inputIndexOf(breakdown)).padStart(3, '0'),
        countryBreakdown(breakdown),
      ]),
    );
  }
  return tree;
}

/** The transaction symbol of a capital-gains record (30xx → xx). */
function inputSymbol(record: NormalizedRecord): CapitalGainsInputSymbol {
  const symbol = Number(record.recordType.slice(2));
  if (!Object.hasOwn(CAPITAL_GAINS_INPUT_KEYS, symbol)) {
    throw new Opcn1214InternalError(`Record ${record.recordType} is not a capital-gains record`);
  }
  return symbol as CapitalGainsInputSymbol;
}

/**
 * The capital-gains appendices of the 30xx `records`, in file order: the symbol of the record
 * type, the header members (the withholding status and asset location as their literals, dates
 * under `dates`, the replacement asset under `replacementAsset`), the withholders
 * (readWithholders), the wallet addresses (readWalletAddresses), the improvements of 3077
 * (readImprovements, each with the code-50 amount of its code 501–505) and the input amounts (the
 * transaction symbol, appendix number, improvement count, "מספר בתל"ם" sequence and codes 501–505
 * are derived).
 */
function capitalGains(records: readonly NormalizedRecord[]): InputTree[] {
  return records.map(record => {
    const symbol = inputSymbol(record);
    const tree: InputTree = { symbol };
    for (const key of CAPITAL_GAINS_INPUT_KEYS[symbol]) {
      const value = record.values[key];
      const codes = CAPITAL_GAINS_ENUM_INPUTS[key];
      setKey(tree, key, codes ? enumLiteral(codes, value) : value);
    }
    const withholders = hasWithholders(symbol)
      ? readWithholders((slot, member) => record.values[withholderKey(slot, member)])
      : undefined;
    if (withholders) {
      tree.withholders = withholders;
    }
    const walletAddresses = hasWalletAddresses(symbol)
      ? readWalletAddresses(slot => record.values[walletAddressKey(slot)])
      : undefined;
    if (walletAddresses) {
      tree.walletAddresses = walletAddresses;
    }
    const improvements =
      symbol === 77
        ? readImprovements((slot, member) =>
            member === 'code50Amount'
              ? record.codes.get(improvementCode(slot))
              : record.values[improvementKey(slot, member)],
          )
        : undefined;
    if (improvements) {
      tree.improvements = improvements;
    }
    // Codes 501–505 of 3077 are read back as the improvements' code-50 amounts.
    tree.amounts = Object.fromEntries(
      [...record.codes].filter(
        ([code]) => symbol !== 77 || improvementSlotOfCode(code) === undefined,
      ),
    );
    return tree;
  });
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
  const rd = report.records.filter(record => record.recordType === '1030');
  if (rd.length > 0) {
    output.rdInvestments = rd.map(rdInvestment);
  }
  // The appendix exists exactly when a 2000 record does; whether 832 agrees is checked by H1. The
  // parser only admits 2200 records after a 2000 record, each for a distinct per-country code.
  const foreign = report.records.find(record => record.recordType === '2000');
  if (foreign) {
    const breakdowns = report.records.filter(record => record.recordType === '2200');
    output.foreignAppendix = foreignAppendix(foreign, breakdowns);
  }
  // Records 30xx in file order: grouped by type, as the generator writes them (SPEC §3.3).
  const appendixRecords = report.records.filter(record =>
    isCapitalGainsRecordType(record.recordType),
  );
  const appendices = capitalGains(appendixRecords);
  if (appendices.length > 0) {
    output.capitalGains = appendices;
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
  // 833 = yes is read back as hasCapitalGainsAppendix only when neither untransmitted appendices
  // nor capital-gains records already explain it (SPEC §7.3, §7.4).
  const untransmitted = main.values['capitalGainsSummary.untransmittedCount'];
  if (
    main.values['declarations.hasCapitalGainsAppendix'] === true &&
    !(typeof untransmitted === 'number' && untransmitted > 0) &&
    appendixRecords.length === 0
  ) {
    setKey(output, 'declarations.hasCapitalGainsAppendix', true);
  }
  // The tree has the members of Report1214Input; values are typed by their layout kinds.
  return output as unknown as Report1214Input;
}
