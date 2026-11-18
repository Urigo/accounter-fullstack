import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IFRSReportingOption,
  IndividualOrCompanyEnum,
  isValidIsraeliID,
  ReportData,
  ReportEntry,
  ReportingMethod,
  validateData,
  YesNo,
} from '@accounter/shaam6111-generator';
import type * as SchemaTypes from '../../../__generated__/types.js';
import {
  endOfTimelessYear,
  getTimelessDateYear,
  timelessDateFromParts,
} from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AdminBusinessesProvider } from '../../financial-entities/providers/admin-businesses.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import type { IGetLedgerRecordsByDatesResult } from '../../ledger/types.js';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from './profit-and-loss.helper.js';
import {
  BALANCE_SHEET_SUMMARY_CODES,
  buildBalanceSheetEntries,
  buildProfitAndLossEntries,
  buildTaxAdjustmentEntries,
  countRoundedLines,
  fileEntries,
  isBalanceSheetCode,
  isCorporateRegistrationNumber,
  isProfitLossCode,
  netAmountsByFinancialEntity,
  PROFIT_LOSS_SUMMARY_CODES,
  profitAndLossMatchesBooks,
  retainedProfitFromProfitAndLoss,
  type Shaam6111Issue,
} from './shaam6111-computation.helper.js';
import {
  calculateCumulativeRnDExpenses,
  calculateTaxAmounts,
  researchAndDevelopmentForTax,
} from './tax.helper.js';

/** The SHAAM 6111 file name, per the software-houses specification (IKSP/DKASPI.DAT). */
export const SHAAM_6111_FILE_NAME = 'DKASPI.DAT';

/**
 * Resolves each financial entity's 6111 code: its own IRS code, or else the default IRS code of
 * its owner's sort code (the same fallback used when an entity is created). A sort code of another
 * business with the same key never applies.
 */
export function irsCodesByEntity(
  financialEntities: readonly Pick<
    IGetAllFinancialEntitiesResult,
    'id' | 'irs_code' | 'sort_code' | 'owner_id'
  >[],
  defaultIrsCodeBySortCode: ReadonlyMap<string, number>,
): Map<string, number> {
  const irsCodes = new Map<string, number>();
  for (const entity of financialEntities) {
    const irsCode =
      entity.irs_code ??
      (entity.sort_code == null
        ? undefined
        : defaultIrsCodeBySortCode.get(`${entity.owner_id}:${entity.sort_code}`));
    if (irsCode != null) {
      irsCodes.set(entity.id, irsCode);
    }
  }
  return irsCodes;
}

const formatAmount = (amount: number) =>
  Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * Flags entities whose balance can't reach the report: no IRS code at all, or an IRS code that
 * is not a P&L / balance sheet line (a typo, a tax-adjustment code, or a summary code, which is
 * always computed from its lines). Groups them per sort code so a large client list stays short.
 */
function mappingIssues(
  cumulativeNetByEntity: ReadonlyMap<string, number>,
  financialEntitiesById: ReadonlyMap<string, IGetAllFinancialEntitiesResult>,
  irsCodeByEntity: ReadonlyMap<string, number>,
  sortCodeNames: ReadonlyMap<number, string>,
): Shaam6111Issue[] {
  const unmappedBySortCode = new Map<number | null, { total: number; names: string[] }>();
  const invalidCodes: string[] = [];
  for (const [entityId, amount] of cumulativeNetByEntity) {
    if (Math.round(amount) === 0) {
      continue;
    }
    const entity = financialEntitiesById.get(entityId);
    const irsCode = irsCodeByEntity.get(entityId);
    if (irsCode == null) {
      const sortCode = entity?.sort_code ?? null;
      const group = unmappedBySortCode.get(sortCode) ?? { total: 0, names: [] };
      group.total += amount;
      group.names.push(entity?.name ?? entityId);
      unmappedBySortCode.set(sortCode, group);
      continue;
    }
    const isLeaf =
      (isProfitLossCode(irsCode) && !PROFIT_LOSS_SUMMARY_CODES.has(irsCode)) ||
      (isBalanceSheetCode(irsCode) && !BALANCE_SHEET_SUMMARY_CODES.has(irsCode));
    if (!isLeaf) {
      invalidCodes.push(`${entity?.name ?? entityId} (${irsCode})`);
    }
  }

  const issues: Shaam6111Issue[] = [];
  for (const [sortCode, { total, names }] of [...unmappedBySortCode.entries()].sort(
    ([a], [b]) => (a ?? 0) - (b ?? 0),
  )) {
    const sortCodeLabel =
      sortCode == null
        ? 'without a sort code'
        : `in sort code ${sortCode}${sortCodeNames.has(sortCode) ? ` (${sortCodeNames.get(sortCode)})` : ''}`;
    const examples = names.slice(0, 5).join(', ') + (names.length > 5 ? ', …' : '');
    issues.push({
      severity: 'WARNING',
      path: 'mapping',
      message: `${names.length} ${names.length === 1 ? 'entity' : 'entities'} ${sortCodeLabel} with a balance of ${formatAmount(total)} (credit − debit, up to year end) have no IRS code and are left out of the report: ${examples}`,
    });
  }
  if (invalidCodes.length) {
    issues.push({
      severity: 'WARNING',
      path: 'mapping',
      message: `Entities mapped to an IRS code that is not a 6111 P&L or balance sheet line (or is a total, which is always computed) are left out of the report: ${invalidCodes.slice(0, 10).join(', ')}${invalidCodes.length > 10 ? ', …' : ''}`,
    });
  }
  return issues;
}

export type Shaam6111ComputedReport = {
  reportData: SchemaTypes.Shaam6111Data;
  issues: Shaam6111Issue[];
};

export async function getShaam6111Data(
  injector: Injector,
  businessId: string,
  year: number,
): Promise<Shaam6111ComputedReport> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year. Must be between 2000 and 2100. Received: ${year}`);
  }

  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const financialEntityId = businessId || ownerId;
  const [business, adminBusiness] = await Promise.all([
    injector.get(BusinessesProvider).getBusinessByIdLoader.load(financialEntityId),
    injector.get(AdminBusinessesProvider).getAdminBusinessByIdLoader.load(financialEntityId),
  ]);

  if (!business) {
    throw new Error('Business not found');
  }

  if (!business?.vat_number) {
    throw new Error('Business does not have a VAT number');
  }

  const fromDate = timelessDateFromParts(1990, 1, 1); // TODO: maybe take company init date as from date
  const toDate = endOfTimelessYear(year);
  const [ledgerRecords, financialEntities, sortCodes] = await Promise.all([
    // the report is per business: read that business's books, not the session's default owner
    injector
      .get(LedgerProvider)
      .getLedgerRecordsByDates({ fromDate, toDate, ownerId: financialEntityId }),
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
    injector.get(SortCodesProvider).getAllSortCodes(),
  ]);

  const financialEntitiesById = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );
  const defaultIrsCodeBySortCode = new Map<string, number>();
  const sortCodeNames = new Map<number, string>();
  for (const sortCode of sortCodes) {
    if (sortCode.owner_id === financialEntityId || !sortCodeNames.has(sortCode.key)) {
      sortCodeNames.set(sortCode.key, sortCode.name);
    }
    if (sortCode.default_irs_code != null) {
      defaultIrsCodeBySortCode.set(
        `${sortCode.owner_id}:${sortCode.key}`,
        sortCode.default_irs_code,
      );
    }
  }
  const irsCodeByEntity = irsCodesByEntity(financialEntities, defaultIrsCodeBySortCode);

  const ledgerByYear = new Map<number, IGetLedgerRecordsByDatesResult[]>();
  for (const record of ledgerRecords) {
    const recordYear = getTimelessDateYear(record.invoice_date);
    const yearRecords = ledgerByYear.get(recordYear) ?? [];
    yearRecords.push(record);
    ledgerByYear.set(recordYear, yearRecords);
  }

  // P&L for the tax year, and retained earnings from the P&L of every year up to it
  const profitAndLoss = buildProfitAndLossEntries(
    netAmountsByFinancialEntity(ledgerByYear.get(year) ?? []),
    irsCodeByEntity,
  );
  const cumulativeNetByEntity = netAmountsByFinancialEntity(ledgerRecords);
  const cumulativeProfitAndLoss = buildProfitAndLossEntries(cumulativeNetByEntity, irsCodeByEntity);
  const balanceSheet = buildBalanceSheetEntries(
    cumulativeNetByEntity,
    irsCodeByEntity,
    retainedProfitFromProfitAndLoss(cumulativeProfitAndLoss),
    countRoundedLines(cumulativeProfitAndLoss, 'profitAndLoss'),
  );

  // Tax adjustments use the same computation as the tax report (annual workflow step 13). R&D is
  // deducted over three years (section 20A), so it needs the two preceding years as well.
  const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
  for (const rndYear of [year - 2, year - 1, year]) {
    decoratedLedgerByYear.set(
      rndYear,
      decorateLedgerRecords(ledgerByYear.get(rndYear) ?? [], financialEntitiesById),
    );
  }
  const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
  const yearProfitLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
  const profitLossByYear = new Map([[year, yearProfitLoss]]);
  const { profitBeforeTax, researchAndDevelopmentExpenses } = yearProfitLoss;
  const researchAndDevelopmentAddBack =
    researchAndDevelopmentForTax(researchAndDevelopmentExpenses).amount * -1;
  const taxableCumulativeResearchAndDevelopment =
    calculateCumulativeRnDExpenses(year, decoratedLedgerByYear, profitLossByYear) / 3;
  const taxAmounts = await calculateTaxAmounts(
    injector,
    year,
    decoratedLedgerRecords,
    researchAndDevelopmentAddBack,
    taxableCumulativeResearchAndDevelopment,
    profitBeforeTax.amount,
  );
  const taxAdjustment = buildTaxAdjustmentEntries({
    profitBeforeTax: profitBeforeTax.amount,
    // rule 3.7 (100 = 6666) holds whenever the two differ only by rounding
    profitAndLossTotal: profitAndLossMatchesBooks(profitAndLoss, profitBeforeTax.amount)
      ? profitAndLoss.find(entry => entry.code === 6666)?.amount
      : undefined,
    researchAndDevelopmentAddBack,
    researchAndDevelopmentForTax: taxAmounts.researchAndDevelopmentExpensesForTax,
    fines: taxAmounts.fines.amount,
    untaxableGifts: taxAmounts.untaxableGifts.amount,
    businessTripsExcessExpenses: taxAmounts.businessTripsExcessExpensesAmount,
    salaryExcessExpenses: taxAmounts.salaryExcessExpensesAmount,
    reserves: taxAmounts.reserves.amount,
    nontaxableLinkage: taxAmounts.nontaxableLinkage.amount,
    taxableIncome: taxAmounts.taxableIncomeAmount,
    hasPreferredTaxRate: taxAmounts.taxRate !== taxAmounts.specialTaxRate,
  });

  const issues: Shaam6111Issue[] = mappingIssues(
    cumulativeNetByEntity,
    financialEntitiesById,
    irsCodeByEntity,
    sortCodeNames,
  );

  const profitLossTotal = profitAndLoss.find(entry => entry.code === 6666)?.amount ?? 0;
  const booksProfitBeforeTax = Math.round(profitBeforeTax.amount);
  // each 6666 line is rounded to the shekel on its own: only a gap beyond that is a mapping problem
  if (!profitAndLossMatchesBooks(profitAndLoss, profitBeforeTax.amount)) {
    issues.push({
      severity: 'ERROR',
      path: 'profitAndLoss.6666',
      message: `Profit before tax per IRS codes (6666: ${formatAmount(profitLossTotal)}) differs from the books (code 100: ${formatAmount(booksProfitBeforeTax)}) by ${formatAmount(profitLossTotal - booksProfitBeforeTax)}. Check the IRS codes of the P&L entities listed above.`,
    });
  }

  const isCompany = isCorporateRegistrationNumber(business.vat_number);
  // The withholding (ניכויים) file is a separate 9-digit file, never the company's own number
  const withholdingTaxFileNumber = [
    adminBusiness?.company_tax_id,
    adminBusiness?.tax_nikuim_pinkas_number,
  ]
    .map(id => id?.trim())
    .find(id => !!id && id !== business.vat_number && isValidIsraeliID(id));
  if (isCompany && !withholdingTaxFileNumber) {
    issues.push({
      severity: 'WARNING',
      path: 'header.withholdingTaxFileNumber',
      message:
        'No valid withholding tax (ניכויים) file number is set for the business; it is mandatory when one exists. Set it in the business admin settings (Withholding Tax → Company Tax ID).',
    });
  }

  const header: SchemaTypes.Shaam6111Header = {
    taxFileNumber: business.vat_number,
    taxYear: year.toString(),
    idNumber: business.vat_number,
    vatFileNumber: business.vat_number,
    withholdingTaxFileNumber,
    industryCode: '6201', // TODO: migrate to DB
    businessDescription: 'פיתוח פלטפורמת תוכנה', // TODO: migrate to DB
    businessType: 'MULTIPLE', // TODO: migrate to DB
    reportingMethod: 'ACCRUAL', // TODO: migrate to DB
    accountingMethod: 'DOUBLE_ENTRY', // TODO: migrate to DB
    accountingSystem: 'COMPUTERIZED',
    includesProfitLoss: true,
    includesTaxAdjustment: true,
    includesBalanceSheet: true,
    profitLossEntryCount: fileEntries(profitAndLoss, 'profitAndLoss').length,
    taxAdjustmentEntryCount: fileEntries(taxAdjustment, 'taxAdjustment').length,
    balanceSheetEntryCount: fileEntries(balanceSheet, 'balanceSheet').length,
    softwareRegistrationNumber: '99999999',
    isPartnership: false, // TODO: migrate to DB
    partnershipCount: undefined, // TODO: migrate to DB
    partnershipProfitShare: undefined, // TODO: migrate to DB
    ifrsImplementationYear: '9999', // TODO: migrate to DB
    ifrsReportingOption: 'NONE', // TODO: migrate to DB
    currencyType: 'SHEKELS', // TODO: migrate to DB
    amountsInThousands: false, // TODO: migrate to DB
    auditOpinionType: 'UNQUALIFIED', // TODO: migrate to DB
  };

  const reportData: SchemaTypes.Shaam6111Data = {
    id: `shaam6111-${business.vat_number}-${year}-data`,
    header,
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    individualOrCompany: isCompany ? 'COMPANY' : 'INDIVIDUAL',
  };
  return { reportData, issues };
}

/**
 * Validates the report the way SHAAM will (the generator's rules on the lines that go into the
 * file), and merges in the report's own diagnostics.
 */
export function validateShaam6111Report(
  reportData: SchemaTypes.Shaam6111Data,
  issues: readonly Shaam6111Issue[] = [],
): { isValid: boolean; issues: Shaam6111Issue[] } {
  const { errors } = validateData(convertLocalReportDataToShaam6111ReportData(reportData));
  const validationIssues: Shaam6111Issue[] = (errors ?? []).map(error => ({
    severity: 'ERROR',
    path: error.path,
    message: error.message,
  }));
  const allIssues = [...validationIssues, ...issues];
  return {
    isValid: !allIssues.some(issue => issue.severity === 'ERROR'),
    issues: allIssues,
  };
}

export function accountingMethodSafeParser(
  accountingMethod: SchemaTypes.AccountingMethod,
): AccountingMethod {
  switch (accountingMethod) {
    case 'DOUBLE_ENTRY':
      return AccountingMethod.DOUBLE_ENTRY;
    case 'SINGLE_ENTRY':
      return AccountingMethod.SINGLE_ENTRY;
    default:
      throw new GraphQLError(`Unknown accounting method: ${accountingMethod}`);
  }
}

export function accountingSystemSafeParser(
  accountingSystem: SchemaTypes.AccountingSystem,
): AccountingSystem {
  switch (accountingSystem) {
    case 'COMPUTERIZED':
      return AccountingSystem.COMPUTERIZED;
    case 'MANUAL':
      return AccountingSystem.MANUAL;
    default:
      throw new GraphQLError(`Unknown accounting system: ${accountingSystem}`);
  }
}

export function auditOpinionTypeSafeParser(
  auditOpinionType?: SchemaTypes.AuditOpinionType | null,
): AuditOpinionType | undefined {
  if (auditOpinionType == null) {
    return undefined;
  }
  switch (auditOpinionType) {
    case 'UNQUALIFIED':
      return AuditOpinionType.UNQUALIFIED;
    case 'UNQUALIFIED_WITH_GOING_CONCERN':
      return AuditOpinionType.UNQUALIFIED_WITH_GOING_CONCERN;
    case 'UNQUALIFIED_WITH_OTHER_EMPHASES':
      return AuditOpinionType.UNQUALIFIED_WITH_OTHER_EMPHASES;
    case 'QUALIFIED':
      return AuditOpinionType.QUALIFIED;
    case 'ADVERSE':
      return AuditOpinionType.ADVERSE;
    case 'DISCLAIMER':
      return AuditOpinionType.DISCLAIMER;
    case 'NONE':
      return AuditOpinionType.NONE;
    default:
      throw new GraphQLError(`Unknown audit opinion type: ${auditOpinionType}`);
  }
}

export function businessTypeSafeParser(businessType: SchemaTypes.BusinessType): BusinessType {
  switch (businessType) {
    case 'COMMERCIAL':
      return BusinessType.COMMERCIAL;
    case 'INDUSTRIAL':
      return BusinessType.INDUSTRIAL;
    case 'SERVICE':
      return BusinessType.SERVICE;
    case 'MULTIPLE':
      return BusinessType.MULTIPLE;
    case 'COMBINATION':
      return BusinessType.COMBINATION;
    default:
      throw new GraphQLError(`Unknown business type: ${businessType}`);
  }
}

export function currencyTypeSafeParser(currencyType: SchemaTypes.CurrencyType): CurrencyType {
  switch (currencyType) {
    case 'SHEKELS':
      return CurrencyType.SHEKELS;
    case 'DOLLARS':
      return CurrencyType.DOLLARS;
    default:
      throw new GraphQLError(`Unknown currency type: ${currencyType}`);
  }
}

export function ifrsReportingOptionSafeParser(
  ifrsReportingOption?: SchemaTypes.IfrsReportingOption,
): IFRSReportingOption | undefined {
  if (ifrsReportingOption == null) {
    return undefined;
  }
  switch (ifrsReportingOption) {
    case 'OPTION_1':
      return IFRSReportingOption.OPTION_1;
    case 'OPTION_2_ADJUSTMENTS':
      return IFRSReportingOption.OPTION_2_ADJUSTMENTS;
    case 'OPTION_3_ADJUSTMENTS':
      return IFRSReportingOption.OPTION_3_ADJUSTMENTS;
    case 'NONE':
      return IFRSReportingOption.NONE;
    default:
      throw new GraphQLError(`Unknown IFRS reporting option: ${ifrsReportingOption}`);
  }
}

export function reportingMethodSafeParser(
  reportingMethod: SchemaTypes.ReportingMethod,
): ReportingMethod {
  switch (reportingMethod) {
    case 'CASH':
      return ReportingMethod.CASH;
    case 'ACCRUAL':
      return ReportingMethod.ACCRUAL;
    case 'DOLLAR_REGULATIONS':
      return ReportingMethod.DOLLAR_REGULATIONS;
    default:
      throw new GraphQLError(`Unknown reporting method: ${reportingMethod}`);
  }
}

export function yesNoSafeParser(yesNo: boolean): YesNo {
  switch (yesNo) {
    case true:
      return YesNo.YES;
    case false:
      return YesNo.NO;
    default:
      throw new GraphQLError(`Unknown Yes/No value: ${yesNo}`);
  }
}

export function yesNoOptionalSafeParser(yesNo?: boolean | null): YesNo | undefined {
  if (yesNo == null) {
    return undefined;
  }
  return yesNoSafeParser(yesNo);
}

export function individualOrCompanySafeParser(
  individualOrCompany: SchemaTypes.IndividualOrCompany,
): IndividualOrCompanyEnum {
  switch (individualOrCompany) {
    case 'INDIVIDUAL':
      return IndividualOrCompanyEnum.INDIVIDUAL;
    case 'COMPANY':
      return IndividualOrCompanyEnum.COMPANY;
    default:
      throw new GraphQLError(`Unknown individual or company type: ${individualOrCompany}`);
  }
}

export function yesNoToBoolean(yesNo: YesNo): boolean {
  switch (yesNo) {
    case YesNo.YES:
      return true;
    case YesNo.NO:
      return false;
    default:
      throw new GraphQLError(`Unknown Yes/No value: ${yesNo}`);
  }
}

export function yesNoToOptionalBoolean(yesNo?: YesNo): boolean | undefined {
  if (yesNo == null) {
    return undefined;
  }
  return yesNoToBoolean(yesNo);
}

export function convertLocalReportDataToShaam6111ReportData(
  localReportData: SchemaTypes.Shaam6111Data,
): ReportData {
  const toReportEntries = (entries: readonly SchemaTypes.Shaam6111ReportEntry[]): ReportEntry[] =>
    entries.map(entry => ({ code: entry.code, amount: entry.amount }));
  // Only the non-zero lines (and mandatory totals) go into the file: a section holds 150 lines
  const profitAndLoss = toReportEntries(
    fileEntries(localReportData.profitAndLoss, 'profitAndLoss'),
  );
  const taxAdjustment = toReportEntries(
    fileEntries(localReportData.taxAdjustment, 'taxAdjustment'),
  );
  const balanceSheet = localReportData.balanceSheet
    ? toReportEntries(fileEntries(localReportData.balanceSheet, 'balanceSheet'))
    : [];
  const adjustedReportData: ReportData = {
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    header: {
      ...localReportData.header,
      vatFileNumber: localReportData.header.vatFileNumber || undefined,
      withholdingTaxFileNumber: localReportData.header.withholdingTaxFileNumber || undefined,
      businessDescription: localReportData.header.businessDescription || undefined,
      businessType: businessTypeSafeParser(localReportData.header.businessType),
      reportingMethod: reportingMethodSafeParser(localReportData.header.reportingMethod),
      accountingMethod: accountingMethodSafeParser(localReportData.header.accountingMethod),
      accountingSystem: accountingSystemSafeParser(localReportData.header.accountingSystem),
      isPartnership: yesNoOptionalSafeParser(localReportData.header.isPartnership),
      includesProfitLoss: yesNoSafeParser(profitAndLoss.length > 0),
      includesTaxAdjustment: yesNoSafeParser(taxAdjustment.length > 0),
      includesBalanceSheet: yesNoSafeParser(balanceSheet.length > 0),
      profitLossEntryCount: profitAndLoss.length,
      taxAdjustmentEntryCount: taxAdjustment.length,
      balanceSheetEntryCount: balanceSheet.length,
      ifrsImplementationYear: localReportData.header.ifrsImplementationYear || undefined,
      ifrsReportingOption: localReportData.header.ifrsReportingOption
        ? ifrsReportingOptionSafeParser(localReportData.header.ifrsReportingOption)
        : undefined,
      softwareRegistrationNumber: localReportData.header.softwareRegistrationNumber || undefined,
      partnershipCount: localReportData.header.partnershipCount || undefined,
      partnershipProfitShare: localReportData.header.partnershipProfitShare || undefined,
      currencyType: currencyTypeSafeParser(localReportData.header.currencyType),
      auditOpinionType: auditOpinionTypeSafeParser(localReportData.header.auditOpinionType),
      amountsInThousands: yesNoSafeParser(localReportData.header.amountsInThousands),
    },
    individualOrCompany: individualOrCompanySafeParser(
      localReportData.individualOrCompany ?? 'COMPANY',
    ),
  };

  return adjustedReportData;
}
