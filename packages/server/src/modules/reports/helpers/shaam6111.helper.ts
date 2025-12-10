import { GraphQLError } from 'graphql';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BALANCE_SHEET_CODE_NAMES,
  BusinessType,
  CurrencyType,
  IFRSReportingOption,
  IndividualOrCompanyEnum,
  NEGATIVE_ALLOWED_BALANCE_SHEET_CODES,
  PROFIT_LOSS_CODE_NAMES,
  ReportData,
  ReportEntry,
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
  SECTION_1_21,
  SECTION_1_27,
  SECTION_1_28,
  SECTION_1_30,
  SECTION_1_32,
  SECTION_1_33,
  SECTION_1_36,
  SECTION_1_37,
  SECTION_1_38,
  SECTION_1_39,
  SECTION_1_40,
  SECTION_1_41,
  SECTION_1_43,
  SECTION_1_44,
  SECTION_1_45,
  SECTION_1_46,
  SECTION_1_48,
  SECTION_1_50,
  SECTION_1_51,
  TAX_ADJUSTMENT_CODE_NAMES,
  YesNo,
} from '@accounter/shaam6111-generator';
import type * as SchemaTypes from '../../../__generated__/types.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { amountByFinancialEntityIdAndSortCodeValidations } from './misc.helper.js';
import {
  DecoratedLedgerRecord,
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from './profit-and-loss.helper.js';
import { calculateCumulativeRnDExpenses, calculateTaxAmounts } from './tax.helper.js';

function cumulativeCodeFormula(
  code: number,
  sectionCodes: readonly number[],
  subtractSectionCodes?: readonly number[],
) {
  return (map: Map<number, { amount: number }>) => {
    const sectionCodeAmounts = sectionCodes
      .filter(sectionCode => sectionCode !== code)
      .map(sectionCode => map.get(sectionCode)?.amount || 0)
      .reduce((a, b) => a + b, 0);
    const subtractSectionCodeAmounts = subtractSectionCodes?.length
      ? subtractSectionCodes
          .filter(sectionCode => sectionCode !== code)
          .map(sectionCode => map.get(sectionCode)?.amount || 0)
          .reduce((a, b) => a + b, 0)
      : 0;
    return sectionCodeAmounts - subtractSectionCodeAmounts;
  };
}

function getProfitAndLossEntries(
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  financialEntitiesByIrsCodeDict: Map<number, IGetAllFinancialEntitiesResult[]>,
): SchemaTypes.Shaam6111ReportEntry[] {
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
      rule: cumulativeCodeFormula(1000, SECTION_1_1),
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
      rule: cumulativeCodeFormula(2500, SECTION_1_4),
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
      rule: cumulativeCodeFormula(
        3500,
        [
          3511, 3513, 3512, 3515, 3520, 3530, 3535, 3540, 3545, 3550, 3560, 3566, 3567, 3570, 3575,
          3580, 3590, 3595, 3600, 3610, 3620, 3625, 3631, 3632, 3640, 3650, 3660, 3665, 3680, 3685,
          3690,
        ],
        [3568],
      ),
    },
    {
      code: 5000,
      rule: cumulativeCodeFormula(5000, SECTION_1_9),
    },
    {
      code: 5100,
      rule: cumulativeCodeFormula(5100, SECTION_1_10),
    },
    {
      code: 5200,
      rule: cumulativeCodeFormula(5200, SECTION_1_11),
    },
    {
      code: 5300,
      rule: cumulativeCodeFormula(5300, SECTION_1_12),
    },
    {
      code: 5600,
      rule: cumulativeCodeFormula(5600, SECTION_1_14),
    },
    {
      code: 5700,
      rule: cumulativeCodeFormula(5700, SECTION_1_15),
    },
    {
      code: 5800,
      rule: cumulativeCodeFormula(5800, SECTION_1_16),
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
  for (const { code, rule } of rules) {
    const entry = profitAndLossCodesMap.get(code);
    if (entry) {
      entry.amount = rule(profitAndLossCodesMap);
    }
  }

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
): Promise<SchemaTypes.Shaam6111ReportEntry[]> {
  const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
  const profitLossByYear = new Map<number, ReturnType<typeof getProfitLossReportAmounts>>();
  let profitAndLoss = profitLossByYear.get(year);
  if (!profitAndLoss) {
    profitAndLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
    profitLossByYear.set(year, profitAndLoss);
  }

  const { profitBeforeTax, researchAndDevelopmentExpenses } = profitAndLoss;

  const adjustedResearchAndDevelopmentExpensesAmount = researchAndDevelopmentExpenses.amount * -1;

  const cumulativeResearchAndDevelopmentExpensesAmount = calculateCumulativeRnDExpenses(
    year,
    decoratedLedgerByYear,
    profitLossByYear,
  );

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
  for (const { code, rule } of rules) {
    const entry = taxAdjustmentCodesMap.get(code);
    if (entry) {
      entry.amount = rule(taxAdjustmentCodesMap);
    }
  }

  const taxAdjustment = Array.from(taxAdjustmentCodesMap.entries())
    .map(([code, { amount, label }]) => ({
      code,
      label,
      amount,
    }))
    .sort((a, b) => a.code - b.code); // Sort by code

  return taxAdjustment;
}

function getBalanceSheetEntries(
  decoratedLedgerRecords: DecoratedLedgerRecord[],
  financialEntitiesByIrsCodeDict: Map<number, IGetAllFinancialEntitiesResult[]>,
): SchemaTypes.Shaam6111ReportEntry[] {
  const balanceSheetAmounts = amountByFinancialEntityIdAndSortCodeValidations(
    decoratedLedgerRecords,
    Object.entries(BALANCE_SHEET_CODE_NAMES).map(([stringCode]) => {
      const code = parseInt(stringCode, 10);
      return {
        rule: financialEntityId => {
          const financialEntitiesByIrsCode = financialEntitiesByIrsCodeDict.get(code) || [];
          return financialEntitiesByIrsCode.some(entity => entity.id === financialEntityId);
        },
        negate: code >= 7000 && code < 9000,
      };
    }),
  );

  const balanceSheetCodesMap = new Map<number, { amount: number; label: string }>(
    Object.entries(BALANCE_SHEET_CODE_NAMES).map(([code, label], index) => {
      const codeInt = parseInt(code, 10);
      let amount = Math.round(balanceSheetAmounts[index] ?? 0);

      // for codes that are not allowed to be negative, we ensure the amount is positive
      if (!(NEGATIVE_ALLOWED_BALANCE_SHEET_CODES as readonly number[]).includes(codeInt)) {
        amount = Math.abs(amount);
      }
      return [
        codeInt,
        {
          label,
          amount,
        },
      ];
    }),
  );

  const cumulativeProfit =
    getProfitAndLossEntries(decoratedLedgerRecords, financialEntitiesByIrsCodeDict).find(
      entry => entry.code === 6666,
    )?.amount || 0;

  // NOTE: the rules order is important here, as some codes depend on others
  // e.g. 7000 depends on 7100, 7200, etc.
  const rules: {
    code: number;
    rule: (codesMap: Map<number, { amount: number; label: string }>) => number;
  }[] = [
    {
      code: 9980,
      rule: () => cumulativeProfit,
    },
    {
      code: 7100,
      rule: cumulativeCodeFormula(7100, SECTION_1_27),
    },
    {
      code: 7200,
      rule: cumulativeCodeFormula(7200, SECTION_1_28),
    },
    {
      code: 7300,
      rule: cumulativeCodeFormula(7300, [7310, 7320, 7330, 7350, 7360, 7390], [7380]),
    },
    {
      code: 7400,
      rule: cumulativeCodeFormula(7400, SECTION_1_30),
    },
    {
      code: 7600,
      rule: cumulativeCodeFormula(7600, SECTION_1_21),
    },
    {
      code: 7700,
      rule: cumulativeCodeFormula(7700, SECTION_1_32),
    },
    {
      code: 7800,
      rule: cumulativeCodeFormula(7800, SECTION_1_33),
    },
    {
      code: 7000,
      rule: cumulativeCodeFormula(7000, [7100, 7200, 7300, 7400, 7600, 7700, 7800]),
    },
    {
      code: 8000,
      rule: cumulativeCodeFormula(
        8000,
        [8010, 8020, 8025, 8030, 8040, 8050, 8060, 8080, 8090, 8095, 8100, 8105, 8170],
        [8110, 8120, 8130, 8140, 8150, 8160, 8180, 8190],
      ),
    },
    {
      code: 8200,
      rule: cumulativeCodeFormula(8200, SECTION_1_37),
    },
    {
      code: 8300,
      rule: cumulativeCodeFormula(8300, SECTION_1_38),
    },
    {
      code: 8400,
      rule: cumulativeCodeFormula(8400, SECTION_1_39),
    },
    {
      code: 8500,
      rule: cumulativeCodeFormula(8500, SECTION_1_40),
    },
    {
      code: 8600,
      rule: cumulativeCodeFormula(8600, SECTION_1_41),
    },
    {
      code: 8700,
      rule: cumulativeCodeFormula(8700, SECTION_1_36),
    },
    {
      code: 8888,
      rule: cumulativeCodeFormula(8888, [7000, 8000, 8200, 8300, 8400, 8500, 8600, 8700]),
    },
    {
      code: 9100,
      rule: cumulativeCodeFormula(9100, SECTION_1_43),
    },
    {
      code: 9200,
      rule: cumulativeCodeFormula(9200, SECTION_1_44),
    },
    {
      code: 9400,
      rule: cumulativeCodeFormula(9400, SECTION_1_45),
    },
    {
      code: 9500,
      rule: cumulativeCodeFormula(9500, SECTION_1_46),
    },
    {
      code: 9000,
      rule: cumulativeCodeFormula(9000, [9100, 9200, 9400, 9500]),
    },
    {
      code: 9600,
      rule: cumulativeCodeFormula(9600, SECTION_1_48),
    },
    {
      code: 9700,
      rule: map =>
        (map.get(9710)?.amount || 0) - (map.get(9720)?.amount || 0) + (map.get(9790)?.amount || 0),
    },
    {
      code: 9800,
      rule: cumulativeCodeFormula(9800, SECTION_1_50),
    },
    {
      code: 9900,
      rule: cumulativeCodeFormula(9900, SECTION_1_51),
    },
    {
      code: 9999,
      rule: cumulativeCodeFormula(9999, [9000, 9600, 9700, 9800, 9900]),
    },
  ];

  // Apply the rules to the tax adjustment codes map
  for (const { code, rule } of rules) {
    const entry = balanceSheetCodesMap.get(code);
    if (entry) {
      entry.amount = rule(balanceSheetCodesMap);
    }
  }

  const balanceSheet = Array.from(balanceSheetCodesMap.entries())
    .map(([code, { amount, label }]) => ({
      code,
      label,
      amount,
    }))
    .sort((a, b) => a.code - b.code); // Sort by code

  return balanceSheet;
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

  const fromDate = new Date(1990, 0, 1, 0, 0, 0, 1); // TODO: maybe take company init date as from date
  const toDate = new Date(year + 1, 0, 0);
  const ledgerRecordsPromise = injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate, toDate });

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
    if (entity.irs_code) {
      const entities = financialEntitiesByIrsCodeDict.get(entity.irs_code) || [];
      entities.push(entity);
      financialEntitiesByIrsCodeDict.set(entity.irs_code, entities);
    }
  });

  const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    const [decoratedRecord] = decorateLedgerRecords([record], financialEntitiesDict);
    if (!decoratedLedgerByYear.has(year)) {
      decoratedLedgerByYear.set(year, []);
    }
    // Add the decorated record to the corresponding year
    decoratedLedgerByYear.get(year)?.push(decoratedRecord);
  });

  const profitAndLoss = getProfitAndLossEntries(
    decoratedLedgerByYear.get(year) || [],
    financialEntitiesByIrsCodeDict,
  );
  const taxAdjustment = await getTaxAdjustmentEntries(context, year, decoratedLedgerByYear);
  const ledgerSinceForever = Array.from(decoratedLedgerByYear.entries()).reduce(
    (acc, [ledgerYear, records]) => {
      if (ledgerYear <= year) {
        return acc.concat(records);
      }
      return acc;
    },
    [] as DecoratedLedgerRecord[],
  );
  const balanceSheet = getBalanceSheetEntries(ledgerSinceForever, financialEntitiesByIrsCodeDict);

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
