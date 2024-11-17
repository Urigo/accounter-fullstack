import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetAllFinancialEntitiesResult } from '@modules/financial-entities/types';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { DEFAULT_LOCAL_CURRENCY, DEVELOPMENT_FOREIGN_TAX_CATEGORY_ID } from '@shared/constants';
import {
  CorporateTaxRule,
  CorporateTaxRulingComplianceReport,
  QueryTaxReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';

type ReportAmounts = {
  totalIncome: number;
  researchAndDevelopmentExpenses: number;
  localDevelopmentExpenses: number;
  foreignDevelopmentExpenses: number;
  businessTripRndExpenses: number;
};

enum ExpenseType {
  Operating = 'OPERATING',
  DevLocal = 'DEV_LOCAL',
  RndTrips = 'RND_TRIPS',
  Salaries = 'SALARIES',
}

function rndTaxCategoryType(sortCode?: number | null): ExpenseType | null {
  if (!sortCode) {
    return null;
  }
  if (sortCode === 910) {
    // operating expenses
    return ExpenseType.Operating;
  }
  if (sortCode === 920) {
    // R&D expenses
    return ExpenseType.DevLocal;
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
  reportAmounts: ReportAmounts,
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

    if (rndType === ExpenseType.DevLocal) {
      reportAmounts.localDevelopmentExpenses -= amount;
    }

    if (rndType === ExpenseType.RndTrips) {
      reportAmounts.businessTripRndExpenses -= amount;
    }

    if (
      rndType === ExpenseType.Operating &&
      financialEntityId === DEVELOPMENT_FOREIGN_TAX_CATEGORY_ID
    ) {
      reportAmounts.foreignDevelopmentExpenses -= amount;
    }
  }
}

function validateCorporateTaxRule(
  ruleDescription: string,
  percentage: number,
  validationFunc: (input: number) => boolean,
): CorporateTaxRule {
  return {
    rule: ruleDescription,
    isCompliant: validationFunc(percentage),
    percentage: {
      value: percentage,
      formatted: `${(percentage * 100).toFixed(2)}%`,
    },
  };
}

function validateForeignDevelopmentOfRnd(percentage: number): CorporateTaxRule {
  return validateCorporateTaxRule(
    'Foreign development expenses are less than 10% of R&D expenses',
    percentage,
    value => value * 100 < 10,
  );
}

function validateLocalDevelopmentOfRnd(percentage: number): CorporateTaxRule {
  return validateCorporateTaxRule(
    'Local development expenses are less than 10% of R&D expenses',
    percentage,
    value => value * 100 < 10,
  );
}

function validateRndOfIncome(percentage: number): CorporateTaxRule {
  return validateCorporateTaxRule(
    'R&D expenses are at least 7% of total incomes',
    percentage,
    value => value * 100 >= 7,
  );
}

export const corporateTaxRulingComplianceReport: ResolverFn<
  ReadonlyArray<ResolversTypes['CorporateTaxRulingComplianceReport']>,
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryTaxReportArgs, 'years'>
> = async (_, { years }, { injector }) => {
  years.map(year => {
    if (year < 2000 || year > new Date().getFullYear()) {
      throw new GraphQLError('Invalid year');
    }
  });

  const from = new Date(Math.min(...years), 0, 1);
  const to = new Date(Math.max(...years) + 1, 0, 0);
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByDates({ fromDate: from, toDate: to });
  const financialEntities = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();
  const financialEntitiesDict = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );

  const reportAmountsByYear = new Map<number, ReportAmounts>(
    years.map(year => [
      year,
      {
        totalIncome: 0,
        researchAndDevelopmentExpenses: 0,
        localDevelopmentExpenses: 0,
        foreignDevelopmentExpenses: 0,
        businessTripRndExpenses: 0,
      },
    ]),
  );

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    const reportAmounts = reportAmountsByYear.get(year);

    if (!reportAmounts) {
      return;
    }

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

  const yearlyReports: CorporateTaxRulingComplianceReport[] = [];
  for (const [year, reportAmounts] of reportAmountsByYear) {
    yearlyReports.push({
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
    });
  }

  return yearlyReports.sort((a, b) => a.year - b.year);
};
