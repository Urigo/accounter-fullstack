import { GraphQLError } from 'graphql';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  HeaderRecord,
  IFRSReportingOption,
  IndividualOrCompanyEnum,
  ReportData,
  ReportEntry,
  ReportingMethod,
  YesNo,
} from '@accounter/shaam6111-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '@modules/financial-entities/types.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import * as SchemaTypes from '@shared/gql-types';
import { amountByFinancialEntityIdAndSortCodeValidations } from './misc.helper.js';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from './profit-and-loss.helper.js';
import { calculateTaxAmounts } from './tax.helper.js';

async function getProfitAndLossEntries(
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  financialEntitiesByIrsCodeDict: Map<number, IGetAllFinancialEntitiesResult[]>,
): Promise<ReportEntry[]> {
  const profitAndLossCodes = [1040, 1000, 1310, 1390, 1300, 2510, 2520, 2550, 2590, 2500];

  const profitAndLossAmounts = amountByFinancialEntityIdAndSortCodeValidations(
    decoratedLedgerRecords,
    profitAndLossCodes.map(code => ({
      rule: financialEntityId => {
        const financialEntitiesByIrsCode = financialEntitiesByIrsCodeDict.get(code) || [];
        return financialEntitiesByIrsCode.some(entity => entity.id === financialEntityId);
      },
    })),
  );

  const profitAndLoss: ReportEntry[] = profitAndLossCodes
    .map((code, index) => ({
      code,
      amount: profitAndLossAmounts[index] ?? 0,
    }))
    .filter(({ amount }) => amount !== 0);

  return profitAndLoss;
}

async function getTaxAdjustmentsEntries(
  context: GraphQLModules.Context,
  year: number,
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>,
): Promise<ReportEntry[]> {
  const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
  const profitLossByYear = new Map<number, ReturnType<typeof getProfitLossReportAmounts>>();
  let profitAndLoss = profitLossByYear.get(year);
  if (!profitAndLoss) {
    profitAndLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
    profitLossByYear.set(year, profitAndLoss);
  }

  const { profitBeforeTax, researchAndDevelopmentExpenses } = profitAndLoss;

  const adjustedResearchAndDevelopmentExpensesAmount = researchAndDevelopmentExpenses.amount * -1;

  let cumulativeResearchAndDevelopmentExpensesAmount = 0;
  for (const rndYear of [year - 2, year - 1, year]) {
    let profitLossHelperReportAmounts = profitLossByYear.get(rndYear);
    if (!profitLossHelperReportAmounts) {
      const rndDecoratedLedgerRecords = decoratedLedgerByYear.get(rndYear) ?? [];
      profitLossHelperReportAmounts = getProfitLossReportAmounts(rndDecoratedLedgerRecords);
      profitLossByYear.set(rndYear, profitLossHelperReportAmounts);
    }

    cumulativeResearchAndDevelopmentExpensesAmount +=
      profitLossHelperReportAmounts.researchAndDevelopmentExpenses.amount;
  }

  const taxableCumulativeResearchAndDevelopmentExpensesAmount =
    cumulativeResearchAndDevelopmentExpensesAmount / 3;

  const {
    researchAndDevelopmentExpensesForTax,
    fines,
    untaxableGifts,
    businessTripsExcessExpensesAmount,
    salaryExcessExpensesAmount,
    reserves,
    nontaxableLinkage,
    taxableIncomeAmount,
  } = await calculateTaxAmounts(
    context,
    year,
    decoratedLedgerRecords,
    adjustedResearchAndDevelopmentExpensesAmount,
    taxableCumulativeResearchAndDevelopmentExpensesAmount,
    profitBeforeTax.amount,
  );

  const amount190 =
    adjustedResearchAndDevelopmentExpensesAmount +
    researchAndDevelopmentExpensesForTax +
    fines.amount +
    untaxableGifts.amount +
    businessTripsExcessExpensesAmount +
    salaryExcessExpensesAmount +
    nontaxableLinkage.amount;

  const taxAdjustments: ReportEntry[] = [
    { code: 104, amount: profitBeforeTax.amount },
    { code: 150, amount: reserves.amount },
    {
      code: 190,
      amount: amount190,
    },
    {
      code: 370,
      amount: amount190 + reserves.amount,
    },
    {
      code: 400,
      amount: taxableIncomeAmount,
    },
    {
      code: 500,
      amount: taxableIncomeAmount,
    },
    {
      code: 510,
      amount: taxableIncomeAmount,
    },
  ];

  return taxAdjustments;
}

export async function getShaam6111Data(
  context: GraphQLModules.Context,
  businessId: string,
  year: number,
): Promise<ReportData> {
  const financialEntityId = businessId || context.adminContext.defaultAdminBusinessId;
  const { injector } = context;
  const businessesProvider = injector.get(BusinessesProvider);
  const business = await businessesProvider.getBusinessByIdLoader.load(financialEntityId);

  if (!business) {
    throw new Error('Business not found');
  }

  if (!business?.vat_number) {
    throw new Error('Business does not have a VAT number');
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year. Must be between 2000 and 2100. Received: ${year}`);
  }

  const from = new Date(year - 2, 0, 1, 0, 0, 0, 1); // Note: take 2 years before the earliest year requested, to calculate R&D spread over 3 years
  const to = new Date(year + 1, 0, 0);
  const ledgerRecordsPromise = injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });

  const financialEntitiesPromise = injector
    .get(FinancialEntitiesProvider)
    .getAllFinancialEntities();

  const [ledgerRecords, financialEntities] = await Promise.all([
    ledgerRecordsPromise,
    financialEntitiesPromise,
  ]);

  const financialEntitiesDict = new Map<string, IGetAllFinancialEntitiesResult>();
  const financialEntitiesByIrsCodeDict = new Map<number, IGetAllFinancialEntitiesResult[]>();
  financialEntities.map(entity => {
    financialEntitiesDict.set(entity.id, entity);
    if (entity.irs_codes) {
      for (const irsCode of entity.irs_codes) {
        const entities = financialEntitiesByIrsCodeDict.get(irsCode) || [];
        entities.push(entity);
        financialEntitiesByIrsCodeDict.set(irsCode, entities);
      }
    }
  });

  const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
  for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
    if (from.getFullYear() > to.getFullYear()) {
      break;
    }

    decoratedLedgerByYear.set(year, []);
  }

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    const [decoratedRecord] = decorateLedgerRecords([record], financialEntitiesDict);
    decoratedLedgerByYear.get(year)?.push(decoratedRecord);
  });

  const profitAndLoss: ReportEntry[] = await getProfitAndLossEntries(
    decoratedLedgerByYear.get(year) || [],
    financialEntitiesByIrsCodeDict,
  );
  const taxAdjustment: ReportEntry[] = await getTaxAdjustmentsEntries(
    context,
    year,
    decoratedLedgerByYear,
  );
  const balanceSheet: ReportEntry[] = [];

  const header: HeaderRecord = {
    taxFileNumber: business.vat_number,
    taxYear: year.toString(),
    idNumber: business.vat_number,
    vatFileNumber: business.vat_number,
    withholdingTaxFileNumber: business.nikuim ?? undefined,
    industryCode: '6201', // TODO: migrate to DB
    businessDescription: 'פיתוח פלטפורמת תוכנה', // TODO: migrate to DB
    businessType: BusinessType.MULTIPLE, // TODO: migrate to DB
    reportingMethod: ReportingMethod.ACCRUAL, // TODO: migrate to DB
    accountingMethod: AccountingMethod.DOUBLE_ENTRY, // TODO: migrate to DB
    accountingSystem: AccountingSystem.COMPUTERIZED,
    includesProfitLoss: profitAndLoss.length ? YesNo.YES : YesNo.NO,
    includesTaxAdjustment: taxAdjustment.length ? YesNo.YES : YesNo.NO,
    includesBalanceSheet: balanceSheet.length ? YesNo.YES : YesNo.NO,
    profitLossEntryCount: profitAndLoss.length ?? undefined,
    taxAdjustmentEntryCount: taxAdjustment.length ?? undefined,
    balanceSheetEntryCount: balanceSheet.length ?? undefined,
    softwareRegistrationNumber: '99999999',
    isPartnership: YesNo.NO, // TODO: migrate to DB
    partnershipCount: undefined, // TODO: migrate to DB
    partnershipProfitShare: undefined, // TODO: migrate to DB
    ifrsImplementationYear: '9999', // TODO: migrate to DB
    ifrsReportingOption: IFRSReportingOption.NONE, // TODO: migrate to DB
    currencyType: CurrencyType.SHEKELS, // TODO: migrate to DB
    amountsInThousands: YesNo.NO, // TODO: migrate to DB
    auditOpinionType: AuditOpinionType.UNQUALIFIED, // TODO: migrate to DB
  };

  const individualOrCompany: IndividualOrCompanyEnum = IndividualOrCompanyEnum.INDIVIDUAL;

  const shaam6111Data: ReportData = {
    header,
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    individualOrCompany,
  };
  return shaam6111Data;
}

export function accountingMethodSafeParser(
  accountingMethod: AccountingMethod,
): SchemaTypes.AccountingMethod {
  switch (accountingMethod) {
    case AccountingMethod.DOUBLE_ENTRY:
      return 'DOUBLE_ENTRY';
    case AccountingMethod.SINGLE_ENTRY:
      return 'SINGLE_ENTRY';
    default:
      throw new GraphQLError(`Unknown accounting method: ${accountingMethod}`);
  }
}

export function accountingSystemSafeParser(
  accountingSystem: AccountingSystem,
): SchemaTypes.AccountingSystem {
  switch (accountingSystem) {
    case AccountingSystem.COMPUTERIZED:
      return 'COMPUTERIZED';
    case AccountingSystem.MANUAL:
      return 'MANUAL';
    default:
      throw new GraphQLError(`Unknown accounting system: ${accountingSystem}`);
  }
}

export function auditOpinionTypeSafeParser(
  auditOpinionType?: AuditOpinionType,
): SchemaTypes.AuditOpinionType | undefined {
  if (auditOpinionType == null) {
    return undefined;
  }
  switch (auditOpinionType) {
    case AuditOpinionType.UNQUALIFIED:
      return 'UNQUALIFIED';
    case AuditOpinionType.UNQUALIFIED_WITH_GOING_CONCERN:
      return 'UNQUALIFIED_WITH_GOING_CONCERN';
    case AuditOpinionType.UNQUALIFIED_WITH_OTHER_EMPHASES:
      return 'UNQUALIFIED_WITH_OTHER_EMPHASES';
    case AuditOpinionType.QUALIFIED:
      return 'QUALIFIED';
    case AuditOpinionType.ADVERSE:
      return 'ADVERSE';
    case AuditOpinionType.DISCLAIMER:
      return 'DISCLAIMER';
    case AuditOpinionType.NONE:
      return 'NONE';
    default:
      throw new GraphQLError(`Unknown audit opinion type: ${auditOpinionType}`);
  }
}

export function businessTypeSafeParser(businessType: BusinessType): SchemaTypes.BusinessType {
  switch (businessType) {
    case BusinessType.COMMERCIAL:
      return 'COMMERCIAL';
    case BusinessType.INDUSTRIAL:
      return 'INDUSTRIAL';
    case BusinessType.SERVICE:
      return 'SERVICE';
    default:
      throw new GraphQLError(`Unknown business type: ${businessType}`);
  }
}

export function currencyTypeSafeParser(currencyType: CurrencyType): SchemaTypes.CurrencyType {
  switch (currencyType) {
    case CurrencyType.SHEKELS:
      return 'SHEKELS';
    case CurrencyType.DOLLARS:
      return 'DOLLARS';
    default:
      throw new GraphQLError(`Unknown currency type: ${currencyType}`);
  }
}

export function ifrsReportingOptionSafeParser(
  ifrsReportingOption?: IFRSReportingOption,
): SchemaTypes.IfrsReportingOption | undefined {
  if (ifrsReportingOption == null) {
    return undefined;
  }
  switch (ifrsReportingOption) {
    case IFRSReportingOption.OPTION_1:
      return 'OPTION_1';
    case IFRSReportingOption.OPTION_2_ADJUSTMENTS:
      return 'OPTION_2_ADJUSTMENTS';
    case IFRSReportingOption.OPTION_3_ADJUSTMENTS:
      return 'OPTION_3_ADJUSTMENTS';
    case IFRSReportingOption.NONE:
      return 'NONE';
    default:
      throw new GraphQLError(`Unknown IFRS reporting option: ${ifrsReportingOption}`);
  }
}

export function reportingMethodSafeParser(
  reportingMethod: ReportingMethod,
): SchemaTypes.ReportingMethod {
  switch (reportingMethod) {
    case ReportingMethod.CASH:
      return 'CASH';
    case ReportingMethod.ACCRUAL:
      return 'ACCRUAL';
    case ReportingMethod.DOLLAR_REGULATIONS:
      return 'DOLLAR_REGULATIONS';
    default:
      throw new GraphQLError(`Unknown reporting method: ${reportingMethod}`);
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
