import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import type { IGetAllFinancialEntitiesResult } from '@modules/financial-entities/types';
import { ledgerGenerationByCharge } from '@modules/ledger/helpers/ledger-by-charge-type.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  DEVELOPMENT_FOREIGN_TAX_CATEGORY_ID,
  DEVELOPMENT_LOCAL_TAX_CATEGORY_ID,
} from '@shared/constants';
import {
  CorporateTaxRule,
  CorporateTaxRulingComplianceReportDifferences,
  QueryCorporateTaxRulingComplianceReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount, hashStringToInt } from '@shared/helpers';
import type { CorporateTaxRulingComplianceReportProto, LedgerRecordsProto } from '@shared/types';

type ReportYearlyInfo = {
  totalIncome: number;
  researchAndDevelopmentExpenses: number;
  localDevelopmentExpenses: number;
  foreignDevelopmentExpenses: number;
  businessTripRndExpenses: number;
  chargeIds: Set<string>;
};

enum ExpenseType {
  Operating = 'OPERATING',
  DevOps = 'DEV_OPS',
  RndTrips = 'RND_TRIPS',
  Salaries = 'SALARIES',
}

function rndTaxCategoryType(sortCode?: number | null): ExpenseType | null {
  if (!sortCode) {
    return null;
  }
  if (sortCode === 920) {
    // R&D expenses
    return ExpenseType.DevOps;
  }
  if (sortCode === 921) {
    // R&D expenses
    return ExpenseType.RndTrips;
  }
  if (sortCode === 930 || sortCode === 931) {
    // salary expenses
    return ExpenseType.Salaries;
  }
  return null;
}

function handleLedgerSingleSide(
  reportAmounts: ReportYearlyInfo,
  financialEntitiesDict: Map<string, IGetAllFinancialEntitiesResult>,
  financialEntityId: string,
  amount: number,
) {
  const financialEntity = financialEntitiesDict.get(financialEntityId);

  if (!financialEntity) {
    throw new GraphQLError(`No financial entity for ID ${financialEntityId}`);
  }

  const sortCode = financialEntity.sort_code;

  if (sortCode && Math.floor(sortCode / 100) === 8) {
    reportAmounts.totalIncome += amount;
  }

  const rndType = rndTaxCategoryType(sortCode);
  if (rndType) {
    // if R&D expense
    reportAmounts.researchAndDevelopmentExpenses -= amount;

    if (rndType === ExpenseType.DevOps) {
      if (financialEntityId === DEVELOPMENT_FOREIGN_TAX_CATEGORY_ID) {
        reportAmounts.foreignDevelopmentExpenses -= amount;
      } else if (financialEntityId === DEVELOPMENT_LOCAL_TAX_CATEGORY_ID) {
        reportAmounts.localDevelopmentExpenses -= amount;
      }
    }

    if (rndType === ExpenseType.RndTrips) {
      reportAmounts.businessTripRndExpenses -= amount;
    }
  }
}

function validateCorporateTaxRule(
  ruleDescription: string,
  percentage: number,
  validationFunc: (input: number) => boolean,
): CorporateTaxRule {
  return {
    id: `corporate-tax-rule-${hashStringToInt(ruleDescription)}`,
    rule: ruleDescription,
    isCompliant: validationFunc(percentage),
    percentage: {
      value: percentage,
      formatted: `${(percentage * 100).toFixed(2)}%`,
    },
  };
}

function validateForeignDevelopmentOfRnd(
  percentage: number,
  isSuggestion = false,
): CorporateTaxRule {
  return validateCorporateTaxRule(
    'Foreign development expenses should be less than 10% of R&D expenses' + isSuggestion
      ? ' (suggestion)'
      : '',
    percentage,
    value => value * 100 < 10,
  );
}

function validateLocalDevelopmentOfRnd(percentage: number, isSuggestion = false): CorporateTaxRule {
  return validateCorporateTaxRule(
    'Local development expenses should be less than 10% of R&D expenses' + isSuggestion
      ? ' (suggestion)'
      : '',
    percentage,
    value => value * 100 < 10,
  );
}

function validateRndOfIncome(percentage: number, isSuggestion = false): CorporateTaxRule {
  return validateCorporateTaxRule(
    'R&D expenses should be at least 7% of total incomes' + isSuggestion ? ' (suggestion)' : '',
    percentage,
    value => value * 100 >= 7,
  );
}

export const corporateTaxRulingComplianceReport: ResolverFn<
  ReadonlyArray<ResolversTypes['CorporateTaxRulingComplianceReport']>,
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryCorporateTaxRulingComplianceReportArgs, 'years'>
> = async (_, { years }, { injector }) => {
  years.map(year => {
    if (year < 2000 || year > new Date().getFullYear()) {
      throw new GraphQLError('Invalid year');
    }
  });

  const from = new Date(Math.min(...years), 0, 1);
  const to = new Date(Math.max(...years) + 1, 0, 0);
  const [ledgerRecords, financialEntities] = await Promise.all([
    injector.get(LedgerProvider).getLedgerRecordsByDates({ fromDate: from, toDate: to }),
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
  ]);

  const financialEntitiesDict = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );

  const reportAmountsByYear = new Map<number, ReportYearlyInfo>(
    years.map(year => [
      year,
      {
        totalIncome: 0,
        researchAndDevelopmentExpenses: 0,
        localDevelopmentExpenses: 0,
        foreignDevelopmentExpenses: 0,
        businessTripRndExpenses: 0,
        chargeIds: new Set<string>(),
      },
    ]),
  );

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    const reportAmounts = reportAmountsByYear.get(year);

    if (!reportAmounts) {
      return;
    }

    reportAmounts.chargeIds.add(record.charge_id);

    if (record.credit_entity1) {
      const amount = Number(record.credit_local_amount1);
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.credit_entity1, amount);
    }

    if (record.credit_entity2) {
      const amount = Number(record.credit_local_amount2);
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.credit_entity2, amount);
    }

    if (record.debit_entity1) {
      const amount = Number(record.debit_local_amount1) * -1;
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.debit_entity1, amount);
    }

    if (record.debit_entity2) {
      const amount = Number(record.debit_local_amount2) * -1;
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.debit_entity2, amount);
    }
  });

  const yearlyReports: CorporateTaxRulingComplianceReportProto[] = [];
  for (const [year, reportAmounts] of reportAmountsByYear) {
    yearlyReports.push({
      id: `corporate-tax-ruling-compliant-report-${year}`,
      year,
      totalIncome: formatFinancialAmount(reportAmounts.totalIncome, DEFAULT_LOCAL_CURRENCY),
      businessTripRndExpenses: formatFinancialAmount(
        reportAmounts.businessTripRndExpenses,
        DEFAULT_LOCAL_CURRENCY,
      ),
      foreignDevelopmentExpenses: formatFinancialAmount(
        reportAmounts.foreignDevelopmentExpenses,
        DEFAULT_LOCAL_CURRENCY,
      ),
      foreignDevelopmentRelativeToRnd: validateForeignDevelopmentOfRnd(
        reportAmounts.foreignDevelopmentExpenses / reportAmounts.researchAndDevelopmentExpenses,
      ),
      localDevelopmentExpenses: formatFinancialAmount(
        reportAmounts.localDevelopmentExpenses,
        DEFAULT_LOCAL_CURRENCY,
      ),
      localDevelopmentRelativeToRnd: validateLocalDevelopmentOfRnd(
        reportAmounts.localDevelopmentExpenses / reportAmounts.researchAndDevelopmentExpenses,
      ),
      researchAndDevelopmentExpenses: formatFinancialAmount(
        reportAmounts.researchAndDevelopmentExpenses,
        DEFAULT_LOCAL_CURRENCY,
      ),
      rndRelativeToIncome: validateRndOfIncome(
        reportAmounts.researchAndDevelopmentExpenses / reportAmounts.totalIncome,
      ),
      chargeIds: reportAmounts.chargeIds,
    });
  }

  return yearlyReports.sort((a, b) => a.year - b.year);
};

function areNumbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export const corporateTaxRulingComplianceReportDifferences: ResolverFn<
  ResolversTypes['CorporateTaxRulingComplianceReportDifferences'],
  ResolversParentTypes['CorporateTaxRulingComplianceReport'],
  GraphQLModules.Context,
  object
> = async (
  {
    year,
    chargeIds,
    businessTripRndExpenses,
    foreignDevelopmentExpenses,
    localDevelopmentExpenses,
    researchAndDevelopmentExpenses,
    totalIncome,
    foreignDevelopmentRelativeToRnd,
    localDevelopmentRelativeToRnd,
    rndRelativeToIncome,
  },
  _,
  context,
  info,
) => {
  const { injector } = context;

  const [charges, financialEntities] = await Promise.all([
    injector
      .get(ChargesProvider)
      .getChargeByIdLoader.loadMany(Array.from(chargeIds))
      .then(res =>
        res.map(charge => {
          if (!charge) {
            throw new GraphQLError(`One of the ledger records has no charge`);
          }
          if (charge instanceof Error) {
            console.error(charge);
            throw new GraphQLError(`Error fetching charge`);
          }
          return charge;
        }),
      ) as Promise<IGetChargesByIdsResult[]>,
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
  ]);

  const ledgerRecords = await Promise.all(
    charges.map(charge =>
      ledgerGenerationByCharge(charge, context)(
        charge,
        { insertLedgerRecordsIfNotExists: false },
        context,
        info,
      ),
    ),
  ).then(res => {
    const successfulRes = res.filter(
      record => record && !('message' in record),
    ) as LedgerRecordsProto[];
    const ledgerRecords = successfulRes
      .map(res => res.records)
      .flat()
      .filter(record => record.invoice_date.getFullYear() === year);
    return ledgerRecords;
  });

  const financialEntitiesDict = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );

  const reportAmounts: ReportYearlyInfo = {
    totalIncome: 0,
    researchAndDevelopmentExpenses: 0,
    localDevelopmentExpenses: 0,
    foreignDevelopmentExpenses: 0,
    businessTripRndExpenses: 0,
    chargeIds: new Set<string>(),
  };

  ledgerRecords.map(record => {
    if (record.credit_entity1) {
      const amount = Number(record.credit_local_amount1);
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.credit_entity1, amount);
    }

    if (record.credit_entity2) {
      const amount = Number(record.credit_local_amount2);
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.credit_entity2, amount);
    }

    if (record.debit_entity1) {
      const amount = Number(record.debit_local_amount1) * -1;
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.debit_entity1, amount);
    }

    if (record.debit_entity2) {
      const amount = Number(record.debit_local_amount2) * -1;
      handleLedgerSingleSide(reportAmounts, financialEntitiesDict, record.debit_entity2, amount);
    }
  });

  const yearlyReport: CorporateTaxRulingComplianceReportDifferences = {
    id: `corporate-tax-ruling-compliant-report-suggestions-${year}`,
    totalIncome: areNumbersEqual(reportAmounts.totalIncome, totalIncome.raw)
      ? null
      : formatFinancialAmount(reportAmounts.totalIncome, DEFAULT_LOCAL_CURRENCY),
    businessTripRndExpenses: areNumbersEqual(
      reportAmounts.businessTripRndExpenses,
      businessTripRndExpenses.raw,
    )
      ? null
      : formatFinancialAmount(reportAmounts.businessTripRndExpenses, DEFAULT_LOCAL_CURRENCY),
    foreignDevelopmentExpenses: areNumbersEqual(
      reportAmounts.foreignDevelopmentExpenses,
      foreignDevelopmentExpenses.raw,
    )
      ? null
      : formatFinancialAmount(reportAmounts.foreignDevelopmentExpenses, DEFAULT_LOCAL_CURRENCY),
    localDevelopmentExpenses: areNumbersEqual(
      reportAmounts.localDevelopmentExpenses,
      localDevelopmentExpenses.raw,
    )
      ? null
      : formatFinancialAmount(reportAmounts.localDevelopmentExpenses, DEFAULT_LOCAL_CURRENCY),
    researchAndDevelopmentExpenses: areNumbersEqual(
      reportAmounts.researchAndDevelopmentExpenses,
      researchAndDevelopmentExpenses.raw,
    )
      ? null
      : formatFinancialAmount(reportAmounts.researchAndDevelopmentExpenses, DEFAULT_LOCAL_CURRENCY),
    foreignDevelopmentRelativeToRnd: ruleDifferences(
      foreignDevelopmentRelativeToRnd,
      validateForeignDevelopmentOfRnd(
        reportAmounts.foreignDevelopmentExpenses / reportAmounts.researchAndDevelopmentExpenses,
      ),
    ),
    localDevelopmentRelativeToRnd: ruleDifferences(
      localDevelopmentRelativeToRnd,
      validateLocalDevelopmentOfRnd(
        reportAmounts.localDevelopmentExpenses / reportAmounts.researchAndDevelopmentExpenses,
      ),
    ),
    rndRelativeToIncome: ruleDifferences(
      rndRelativeToIncome,
      validateRndOfIncome(reportAmounts.researchAndDevelopmentExpenses / reportAmounts.totalIncome),
    ),
  };

  return yearlyReport;
};

function ruleDifferences(
  originalRule: CorporateTaxRule,
  diffRule: CorporateTaxRule,
): CorporateTaxRule | null {
  if (
    originalRule.isCompliant !== diffRule.isCompliant ||
    originalRule.percentage.value !== diffRule.percentage.value
  ) {
    return diffRule;
  }

  return null;
}
