/** Normalizer of record 1000, the main form (SPEC §7.2–§7.4, §4.5). */
import type { YearLayout } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedRecord } from '../model/normalized.js';
import type { ValidateOptions } from '../model/options.js';
import type { Issue } from '../validate/issue.js';
import { deriveCode008, deriveCode273, deriveHasCapitalGainsAppendix } from './derive.js';
import { CONSOLIDATED_REPORT_CODES, enumCode, FORM_6111_OBLIGATION_CODES } from './enums.js';
import { headerValues, roundAmount } from './fields.js';
import { codeKey, pathFor, REPORTABLE_POSITION_KEYS } from './paths.js';
import { phonePrefix } from './phone.js';
import { normalizeText } from './text.js';
import { todayInJerusalem } from './today.js';

/** 1000@150 when meta.softwareName is absent (SPEC §7.4). */
export const DEFAULT_SOFTWARE_NAME = 'ACCOUNTER';

export interface NormalizedMain {
  record: NormalizedRecord;
  /** Codes whose input value 0 was omitted because the code is not zeroAllowed (SPEC §4.5). */
  omittedZeroCodes: string[];
  /** Raised while normalizing: invalid phone prefixes, which are dropped (field.phonePrefix). */
  notices: Issue[];
}

/** A presence flag (SPEC §7.3): marked when the declaration object exists, else absent. */
function marked(declaration: object | undefined): true | undefined {
  return declaration === undefined ? undefined : true;
}

/**
 * Record 1000 of `input`: header values, derived values and the code-amount section. Amounts are
 * rounded per `options.rounding` (SPEC §4.4) before zero codes are omitted.
 */
export function normalizeMain(
  input: Report1214Input,
  layout: YearLayout,
  options: ValidateOptions,
): NormalizedMain {
  const def = layout.records['1000'];
  const {
    attachments,
    capitalGainsSummary,
    company,
    declarations,
    meta,
    otherTaxableIncome,
    preparer,
    qualifyingCompany,
  } = input;
  const today = options.today ?? (() => todayInJerusalem());
  const notices: Issue[] = [];
  const prefix = (key: string, value: string | undefined) =>
    phonePrefix(def, 0, key, value, notices);

  const { values, paths } = headerValues(
    def,
    0,
    {
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
      'company.phone.prefix': prefix('company.phone.prefix', company.phone.prefix),
      'company.phone.number': company.phone.number,
      'company.fax.prefix': prefix('company.fax.prefix', company.fax?.prefix),
      'company.fax.number': company.fax?.number,
      'preparer.officeName': preparer?.officeName,
      'preparer.contactName': preparer?.contactName,
      'preparer.name': preparer?.name,
      'preparer.profession': preparer?.profession,
      'preparer.licensedDealerNumber': preparer?.licensedDealerNumber,
      'preparer.address': preparer?.address,
      'preparer.phone.prefix': prefix('preparer.phone.prefix', preparer?.phone?.prefix),
      'preparer.phone.number': preparer?.phone?.number,
      // 832 (SPEC §7.4): the model has no foreign appendix yet.
      hasForeignAppendix: false,
      'declarations.hasCapitalGainsAppendix': deriveHasCapitalGainsAppendix(input),
      'declarations.form6111Obligation': enumCode(
        FORM_6111_OBLIGATION_CODES,
        declarations.form6111Obligation,
      ),
      'declarations.financialStatementsAttached': declarations.financialStatementsAttached,
      'declarations.familyCompany.isFamilyCompany': marked(declarations.familyCompany),
      'declarations.familyCompany.representativeFileNumber':
        declarations.familyCompany?.representativeFileNumber,
      'declarations.isHouseCompany': declarations.isHouseCompany,
      'declarations.form1343Attached': declarations.form1343Attached,
      'declarations.form1344Attached': declarations.form1344Attached,
      'declarations.claimsCapitalInvestmentLawBenefits':
        declarations.claimsCapitalInvestmentLawBenefits,
      'declarations.preferredEnterprise': declarations.preferredEnterprise,
      'declarations.beneficiaryEnterprise.marked': marked(declarations.beneficiaryEnterprise),
      'declarations.beneficiaryEnterprise.noticeDate':
        declarations.beneficiaryEnterprise?.noticeDate,
      'declarations.dividendDistributed': declarations.dividendDistributed,
      'declarations.specialYear.marked': marked(declarations.specialYear),
      'declarations.specialYear.balanceSheetDate': declarations.specialYear?.balanceSheetDate,
      'declarations.foreignInvestors': declarations.foreignInvestors,
      'declarations.consolidatedReport': enumCode(
        CONSOLIDATED_REPORT_CODES,
        declarations.consolidatedReport,
      ),
      'declarations.partnerInPartnership': declarations.partnerInPartnership,
      'declarations.isKibbutz': declarations.isKibbutz,
      'declarations.hasTaxPlanningAction': declarations.hasTaxPlanningAction,
      'declarations.hadRelatedPartyTransactions': declarations.hadRelatedPartyTransactions,
      'declarations.controlsBodyOfPersons': declarations.controlsBodyOfPersons,
      'declarations.holdsRightsInBodyOfPersons': declarations.holdsRightsInBodyOfPersons,
      'declarations.appliesAccountingStandards': declarations.appliesAccountingStandards,
      'declarations.requestsAdvancePayments': declarations.requestsAdvancePayments,
      'declarations.hasBuildingIncome': declarations.hasBuildingIncome,
      'declarations.isTrustBeneficiary': declarations.isTrustBeneficiary,
      'otherTaxableIncome.source': otherTaxableIncome?.source,
      'otherTaxableIncome.amount': otherTaxableIncome?.amount,
      'otherTaxableIncome.ratePercent': otherTaxableIncome?.ratePercent,
      'attachments.donationReceiptsCount': attachments?.donationReceiptsCount,
      'attachments.withholdingCertificatesCount': attachments?.withholdingCertificatesCount,
      'capitalGainsSummary.totalAppendicesCount': capitalGainsSummary?.totalAppendicesCount,
      'capitalGainsSummary.untransmittedCount': capitalGainsSummary?.untransmittedCount,
      'capitalGainsSummary.reasons.lossOrNoGain': capitalGainsSummary?.reasons?.lossOrNoGain,
      'capitalGainsSummary.reasons.overFiveImprovementBalances':
        capitalGainsSummary?.reasons?.overFiveImprovementBalances,
      'capitalGainsSummary.reasons.over14Appendices':
        capitalGainsSummary?.reasons?.over14Appendices,
      'capitalGainsSummary.reasons.other': capitalGainsSummary?.reasons?.other,
      'capitalGainsSummary.reasons.otherText': capitalGainsSummary?.reasons?.otherText,
      'declarations.directorsReceivedOpinion': declarations.directorsReceivedOpinion,
      'declarations.tookReportablePosition': declarations.tookReportablePosition,
      'declarations.nonDeductibleSalaryExpenses': declarations.nonDeductibleSalaryExpenses,
      'declarations.fewMembersCompany62A': declarations.fewMembersCompany62A,
      'declarations.partOfMultinationalGroup': declarations.partOfMultinationalGroup,
      // Positions after the fifth have no field (SPEC §7.3).
      ...Object.fromEntries(
        REPORTABLE_POSITION_KEYS.map((key, index) => [
          key,
          declarations.reportablePositions?.[index],
        ]),
      ),
      'declarations.noBankAccount': declarations.noBankAccount,
      'qualifyingCompany.purchased': qualifyingCompany?.purchased,
      'qualifyingCompany.israeliPurchaseAmount': qualifyingCompany?.israeliPurchaseAmount,
      'qualifyingCompany.foreignPurchaseAmount': qualifyingCompany?.foreignPurchaseAmount,
      'qualifyingCompany.amortizationClaimed': qualifyingCompany?.amortizationClaimed,
      'qualifyingCompany.amortizationAmount': qualifyingCompany?.amortizationAmount,
    },
    options.rounding,
  );

  const derivedCodes: Readonly<Partial<Record<string, number>>> = {
    '008': deriveCode008(declarations),
    '273': deriveCode273(declarations),
  };
  const amounts: Readonly<Partial<Record<string, number>>> = input.amounts;
  const codes = new Map<string, number>();
  const omittedZeroCodes: string[] = [];
  for (const { code, derived, kind, zeroAllowed } of def.codes) {
    const input = derived ? derivedCodes[code] : amounts[code];
    if (input === undefined) {
      continue;
    }
    const value = roundAmount(kind, input, options.rounding);
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
    notices,
  };
}
