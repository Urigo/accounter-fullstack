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
  ReportData,
  ReportEntry,
  ReportingMethod,
  YesNo,
} from '@accounter/shaam6111-generator';
import type * as SchemaTypes from '../../../__generated__/types.js';
import {
  endOfTimelessYear,
  getTimelessDateYear,
  timelessDateFromParts,
} from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import type { IGetLedgerRecordsByDatesResult } from '../../ledger/types.js';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from './profit-and-loss.helper.js';
import {
  buildBalanceSheetEntries,
  buildProfitAndLossEntries,
  buildTaxAdjustmentEntries,
  countRoundedLines,
  netAmountsByFinancialEntity,
  profitAndLossMatchesBooks,
  retainedProfitFromProfitAndLoss,
} from './shaam6111-computation.helper.js';
import { calculateCumulativeRnDExpenses, calculateTaxAmounts } from './tax.helper.js';

export async function getShaam6111Data(
  injector: Injector,
  businessId: string,
  year: number,
): Promise<SchemaTypes.Shaam6111Data> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year. Must be between 2000 and 2100. Received: ${year}`);
  }

  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const financialEntityId = businessId || ownerId;
  const business = await injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(financialEntityId);

  if (!business) {
    throw new Error('Business not found');
  }

  if (!business?.vat_number) {
    throw new Error('Business does not have a VAT number');
  }

  const fromDate = timelessDateFromParts(1990, 1, 1); // TODO: maybe take company init date as from date
  const toDate = endOfTimelessYear(year);
  const [ledgerRecords, financialEntities] = await Promise.all([
    injector.get(LedgerProvider).getLedgerRecordsByDates({ fromDate, toDate }),
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
  ]);

  const financialEntitiesById = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );
  const irsCodeByEntity = new Map<string, number>();
  for (const entity of financialEntities) {
    if (entity.irs_code != null) {
      irsCodeByEntity.set(entity.id, entity.irs_code);
    }
  }

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
  const researchAndDevelopmentAddBack = researchAndDevelopmentExpenses.amount * -1;
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

  const header: SchemaTypes.Shaam6111Header = {
    taxFileNumber: business.vat_number,
    taxYear: year.toString(),
    idNumber: business.vat_number,
    vatFileNumber: business.vat_number,
    withholdingTaxFileNumber: undefined, // TODO: fetch from admin business
    industryCode: '6201', // TODO: migrate to DB
    businessDescription: 'פיתוח פלטפורמת תוכנה', // TODO: migrate to DB
    businessType: 'MULTIPLE', // TODO: migrate to DB
    reportingMethod: 'ACCRUAL', // TODO: migrate to DB
    accountingMethod: 'DOUBLE_ENTRY', // TODO: migrate to DB
    accountingSystem: 'COMPUTERIZED',
    includesProfitLoss: !!profitAndLoss.length,
    includesTaxAdjustment: !!taxAdjustment.length,
    includesBalanceSheet: !!balanceSheet.length,
    profitLossEntryCount: profitAndLoss.length,
    taxAdjustmentEntryCount: taxAdjustment.length,
    balanceSheetEntryCount: balanceSheet.length,
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
    individualOrCompany: 'INDIVIDUAL', // TODO: migrate to DB
  };
  return reportData;
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
  const profitAndLoss: ReportEntry[] = localReportData.profitAndLoss.map(entry => ({
    code: entry.code,
    amount: entry.amount,
  }));
  const taxAdjustment: ReportEntry[] = localReportData.taxAdjustment.map(entry => ({
    code: entry.code,
    amount: entry.amount,
  }));
  const balanceSheet: ReportEntry[] = localReportData.balanceSheet
    ? localReportData.balanceSheet.map(entry => ({
        code: entry.code,
        amount: entry.amount,
      }))
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
      includesProfitLoss: yesNoSafeParser(localReportData.header.includesProfitLoss),
      includesTaxAdjustment: yesNoSafeParser(localReportData.header.includesTaxAdjustment),
      includesBalanceSheet: yesNoSafeParser(localReportData.header.includesBalanceSheet),
      profitLossEntryCount: localReportData.profitAndLoss.length,
      taxAdjustmentEntryCount: localReportData.taxAdjustment.length,
      balanceSheetEntryCount: localReportData.balanceSheet?.length,
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
      localReportData.individualOrCompany ?? 'COMPANY', // TODO: deduce default value from header
    ),
  };

  return adjustedReportData;
}
