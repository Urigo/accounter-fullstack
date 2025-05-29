import { GraphQLError } from 'graphql';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IFRSReportingOption,
  PROFIT_LOSS_CODE_NAMES,
  ReportingMethod,
  SECTION_1_1,
  SECTION_1_4,
  SECTION_1_9,
  SECTION_1_10,
  SECTION_1_11,
  SECTION_1_12,
  SECTION_1_14,
  SECTION_1_15,
  SECTION_1_16,
  TAX_ADJUSTMENT_CODE_NAMES,
  YesNo,
} from '@accounter/shaam6111-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '@modules/financial-entities/types.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import * as SchemaTypes from '@shared/gql-types';
import { Shaam6111ReportEntry } from '@shared/gql-types';
import { amountByFinancialEntityIdAndSortCodeValidations } from './misc.helper.js';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from './profit-and-loss.helper.js';
import { calculateTaxAmounts } from './tax.helper.js';

function cumulativeCodeFormula(
  code: number,
  sectionCodes: readonly number[],
  map: Map<number, { amount: number }>,
) {
  return sectionCodes
    .filter(sectionCode => sectionCode !== code)
    .map(sectionCode => map.get(sectionCode)?.amount || 0)
    .reduce((a, b) => a + b, 0);
}

async function getProfitAndLossEntries(
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  financialEntitiesByIrsCodeDict: Map<number, IGetAllFinancialEntitiesResult[]>,
): Promise<Shaam6111ReportEntry[]> {
  const profitAndLossAmounts = amountByFinancialEntityIdAndSortCodeValidations(
    decoratedLedgerRecords,
    Object.entries(PROFIT_LOSS_CODE_NAMES).map(([code]) => {
      const codeInt = parseInt(code, 10);
      return {
        rule: financialEntityId => {
          const financialEntitiesByIrsCode = financialEntitiesByIrsCodeDict.get(codeInt) || [];
          return financialEntitiesByIrsCode.some(entity => entity.id === financialEntityId);
        },
        negate: codeInt >= 1300 && codeInt < 5100,
      };
    }),
  );

  const profitAndLossCodesMap = new Map<number, { amount: number; label: string }>(
    Object.entries(PROFIT_LOSS_CODE_NAMES).map(([code, label], index) => [
      parseInt(code, 10),
      {
        label,
        amount: Math.round(profitAndLossAmounts[index] ?? 0),
      },
    ]),
  );

  const rules: {
    code: number;
    rule: (codesMap: Map<number, { amount: number; label: string }>) => number;
  }[] = [
    {
      code: 1000,
      rule: map => cumulativeCodeFormula(1000, SECTION_1_1, map),
    },
    {
      code: 1300,
      rule: map => {
        return (
          [1306, 1308, 1307, 1310, 1320, 1330, 1340, 1350, 1360, 1371, 1372, 1390, 1400]
            .map(code => map.get(code)?.amount || 0)
            .reduce((a, b) => a + b, 0) - (map.get(1450)?.amount || 0)
        );
      },
    },
    {
      code: 2000,
      rule: map =>
        [
          2005, 2006, 2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2060, 2066, 2067,
          2070, 2075, 2080, 2085, 2090,
        ]
          .map(code => map.get(code)?.amount || 0)
          .reduce((a, b) => a + b, 0) -
        (map.get(2068)?.amount || 0) -
        (map.get(2095)?.amount || 0),
    },
    {
      code: 2500,
      rule: map => cumulativeCodeFormula(2500, SECTION_1_4, map),
    },
    {
      code: 3000,
      rule: map =>
        [
          3011, 3013, 3012, 3015, 3020, 3025, 3030, 3040, 3045, 3050, 3060, 3066, 3067, 3070, 3075,
          3080, 3085, 3090, 3100, 3120, 3190,
        ]
          .map(code => map.get(code)?.amount || 0)
          .reduce((a, b) => a + b, 0) - (map.get(3068)?.amount || 0),
    },
    {
      code: 3500,
      rule: map =>
        [
          3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3570, 3575,
          3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680, 3685,
          3690,
        ]
          .map(code => map.get(code)?.amount || 0)
          .reduce((a, b) => a + b, 0) - (map.get(3568)?.amount || 0),
    },
    {
      code: 5000,
      rule: map => cumulativeCodeFormula(5000, SECTION_1_9, map),
    },
    {
      code: 5100,
      rule: map => cumulativeCodeFormula(5100, SECTION_1_10, map),
    },
    {
      code: 5200,
      rule: map => cumulativeCodeFormula(5200, SECTION_1_11, map),
    },
    {
      code: 5300,
      rule: map => cumulativeCodeFormula(5300, SECTION_1_12, map),
    },
    {
      code: 5600,
      rule: map => cumulativeCodeFormula(5600, SECTION_1_14, map),
    },
    {
      code: 5700,
      rule: map => cumulativeCodeFormula(5700, SECTION_1_15, map),
    },
    {
      code: 5800,
      rule: map => cumulativeCodeFormula(5800, SECTION_1_16, map),
    },
    {
      code: 6666,
      rule: map =>
        (map.get(1000)?.amount || 0) -
        (map.get(1300)?.amount || 0) -
        (map.get(2000)?.amount || 0) -
        (map.get(2500)?.amount || 0) -
        (map.get(3000)?.amount || 0) -
        (map.get(3500)?.amount || 0) -
        (map.get(5000)?.amount || 0) +
        (map.get(5100)?.amount || 0) +
        (map.get(5200)?.amount || 0) -
        (map.get(5300)?.amount || 0),
    },
  ];

  // Apply the rules to the tax adjustment codes map
  rules.map(({ code, rule }) => {
    const entry = profitAndLossCodesMap.get(code);
    if (entry) {
      entry.amount = rule(profitAndLossCodesMap);
    }
  });

  const profitAndLoss = Array.from(profitAndLossCodesMap.entries())
    .map(([code, { amount, label }]) => ({
      code,
      label,
      amount,
    }))
    .sort((a, b) => a.code - b.code); // Sort by code

  return profitAndLoss;
}

async function getTaxAdjustmentEntries(
  context: GraphQLModules.Context,
  year: number,
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>,
): Promise<Shaam6111ReportEntry[]> {
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

  const taxAdjustmentCodesMap = new Map<number, { amount: number; label: string }>(
    Object.entries(TAX_ADJUSTMENT_CODE_NAMES).map(([code, label]) => [
      parseInt(code, 10),
      {
        label,
        amount: 0,
      },
    ]),
  );

  const rules: {
    code: number;
    rule: (codesMap: Map<number, { amount: number; label: string }>) => number;
  }[] = [
    {
      code: 100,
      rule: () => {
        return Math.round(profitBeforeTax.amount);
      },
    },
    {
      code: 104,
      rule: () => {
        return Math.round(profitBeforeTax.amount);
      },
    },
    {
      code: 150,
      rule: () => {
        return Math.round(reserves.amount);
      },
    },
    {
      code: 190,
      rule: () => {
        return Math.round(amount190);
      },
    },
    {
      code: 400,
      rule: () => {
        return Math.round(taxableIncomeAmount);
      },
    },
    {
      code: 510,
      rule: () => {
        return Math.round(taxableIncomeAmount);
      },
    },
    // summation rules
    {
      code: 370,
      rule: map => {
        return (
          [110, 120, 140, 150, 160, 181, 182, 183, 184, 190, 310, 330, 350, 360]
            .map(code => map.get(code)?.amount || 0)
            .reduce((a, b) => a + b, 0) -
          [130, 135, 170, 180, 200, 300, 320]
            .map(code => map.get(code)?.amount || 0)
            .reduce((a, b) => a + b, 0)
        );
      },
    },
    {
      code: 500,
      rule: map => {
        return (
          (map.get(400)?.amount || 0) -
          (map.get(430)?.amount || 0) -
          (map.get(480)?.amount || 0) +
          (map.get(490)?.amount || 0)
        );
      },
    },
  ];

  // Apply the rules to the tax adjustment codes map
  rules.map(({ code, rule }) => {
    const entry = taxAdjustmentCodesMap.get(code);
    if (entry) {
      entry.amount = rule(taxAdjustmentCodesMap);
    }
  });

  const taxAdjustment = Array.from(taxAdjustmentCodesMap.entries())
    .map(([code, { amount, label }]) => ({
      code,
      label,
      amount,
    }))
    .sort((a, b) => a.code - b.code); // Sort by code

  return taxAdjustment;
}

export async function getShaam6111Data(
  context: GraphQLModules.Context,
  businessId: string,
  year: number,
): Promise<SchemaTypes.Shaam6111Data> {
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

  const profitAndLoss: Shaam6111ReportEntry[] = await getProfitAndLossEntries(
    decoratedLedgerByYear.get(year) || [],
    financialEntitiesByIrsCodeDict,
  );
  const taxAdjustment: Shaam6111ReportEntry[] = await getTaxAdjustmentEntries(
    context,
    year,
    decoratedLedgerByYear,
  );
  const balanceSheet: Shaam6111ReportEntry[] = [];

  const header: SchemaTypes.Shaam6111Header = {
    taxFileNumber: business.vat_number,
    taxYear: year.toString(),
    idNumber: business.vat_number,
    vatFileNumber: business.vat_number,
    withholdingTaxFileNumber: business.nikuim ?? undefined,
    industryCode: '6201', // TODO: migrate to DB
    businessDescription: 'פיתוח פלטפורמת תוכנה', // TODO: migrate to DB
    businessType: 'MULTIPLE', // TODO: migrate to DB
    reportingMethod: 'ACCRUAL', // TODO: migrate to DB
    accountingMethod: 'DOUBLE_ENTRY', // TODO: migrate to DB
    accountingSystem: 'COMPUTERIZED',
    includesProfitLoss: !!profitAndLoss.length,
    includesTaxAdjustment: !!taxAdjustment.length,
    includesBalanceSheet: !!balanceSheet.length,
    profitLossEntryCount: profitAndLoss.length ?? undefined,
    taxAdjustmentEntryCount: taxAdjustment.length ?? undefined,
    balanceSheetEntryCount: balanceSheet.length ?? undefined,
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

  const shaam6111Data: SchemaTypes.Shaam6111Data = {
    id: `shaam6111-${business.vat_number}-${year}-data`,
    header,
    profitAndLoss,
    taxAdjustment,
    balanceSheet,
    individualOrCompany: 'INDIVIDUAL', // TODO: migrate to DB
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
    case BusinessType.MULTIPLE:
      return 'MULTIPLE';
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
