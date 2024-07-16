import { GraphQLError } from 'graphql';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { IGetLedgerRecordsByDatesResult } from '@modules/ledger/types';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  ProfitAndLossReport,
  QueryProfitAndLossReportArgs,
  RequireFields,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';

type LedgerRecordDecorations = Partial<{
  credit_entity_sort_code1: number;
  credit_entity_sort_code2: number;
  debit_entity_sort_code1: number;
  debit_entity_sort_code2: number;
}>;

type DecoratedLedgerRecord = IGetLedgerRecordsByDatesResult & LedgerRecordDecorations;

export const profitAndLossReport: ResolverFn<
  ReadonlyArray<ResolversTypes['ProfitAndLossReport']>,
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  RequireFields<QueryProfitAndLossReportArgs, 'years'>
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

  const financialEntitiesIds = new Set(
    ledgerRecords
      .map(record => [
        record.credit_entity1,
        record.credit_entity2,
        record.debit_entity1,
        record.debit_entity2,
      ])
      .flat()
      .filter(Boolean) as string[],
  );
  const financialEntities = (await injector
    .get(FinancialEntitiesProvider)
    .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntitiesIds))
    .then(res =>
      res.filter(entity => {
        if (!entity) {
          return false;
        }
        if (entity instanceof Error) {
          throw entity;
        }
        return true;
      }),
    )) as IGetFinancialEntitiesByIdsResult[];

  const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

  const ledgerByYear = new Map<number, IGetLedgerRecordsByDatesResult[]>(
    years.map(year => [year, []]),
  );

  ledgerRecords.map(record => {
    const year = record.invoice_date.getFullYear();
    ledgerByYear.get(year)?.push(record);
  });

  const yearlyReports: ProfitAndLossReport[] = [];
  for (const [year, ledgerRecords] of ledgerByYear) {
    const decoratedLedgerRecords = decorateLedgerRecords(ledgerRecords, financialEntitiesDict);

    const revenueAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => Math.floor(sortCode / 100) === 8,
    );

    const costOfSalesAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 910,
    );

    const grossProfitAmount = revenueAmount + costOfSalesAmount;

    const researchAndDevelopmentExpensesAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => [920, 930].includes(sortCode),
    );

    const marketingExpensesAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 935,
    );

    const managementAndGeneralExpensesAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => [940, 945].includes(sortCode),

      // split 945 trips into 936 marketing trips and 921 r&d trips
    );

    const operatingProfitAmount =
      grossProfitAmount +
      researchAndDevelopmentExpensesAmount +
      marketingExpensesAmount +
      managementAndGeneralExpensesAmount;

    const financialExpensesAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 990,
    );

    const otherIncomeAmount = amountBySortCodeValidation(
      decoratedLedgerRecords,
      sortCode => sortCode === 995,
    );

    const profitBeforeTaxAmount =
      operatingProfitAmount + financialExpensesAmount + otherIncomeAmount;

    // 999: profitBeforeTaxAmount

    // הוצאות מימון (שערוכים, שערי המרה) 990 למעט to pay / to collect

    // רווח לפני מיסים (דלתא)

    // מיסים
    // 3 סוגי התאמות:
    // מתנות - אף פעם לא מוכר
    // קנסות
    // מחקר ופיתוח: פער זמני, נפרש על פני 3 שנים
    // דוחות נסיעה

    // רווח שנתי נטו

    //   untaxable expenses:
    //     gifts over 190 ILS per gift
    //     fines
    //     a portion of the salary expenses of Uri&Dotan - a report from accounting
    //     R&D expenses - spread over 3 years

    yearlyReports.push({
      year,
      revenue: formatFinancialAmount(revenueAmount, DEFAULT_LOCAL_CURRENCY),
      costOfSales: formatFinancialAmount(costOfSalesAmount, DEFAULT_LOCAL_CURRENCY),
      grossProfit: formatFinancialAmount(grossProfitAmount, DEFAULT_LOCAL_CURRENCY),
      researchAndDevelopmentExpenses: formatFinancialAmount(
        researchAndDevelopmentExpensesAmount,
        DEFAULT_LOCAL_CURRENCY,
      ),
      marketingExpenses: formatFinancialAmount(marketingExpensesAmount, DEFAULT_LOCAL_CURRENCY),
      managementAndGeneralExpenses: formatFinancialAmount(
        managementAndGeneralExpensesAmount,
        DEFAULT_LOCAL_CURRENCY,
      ),
      operatingProfit: formatFinancialAmount(operatingProfitAmount, DEFAULT_LOCAL_CURRENCY),
      financialExpenses: formatFinancialAmount(financialExpensesAmount, DEFAULT_LOCAL_CURRENCY),
      otherIncome: formatFinancialAmount(otherIncomeAmount, DEFAULT_LOCAL_CURRENCY),
      profitBeforeTax: formatFinancialAmount(profitBeforeTaxAmount, DEFAULT_LOCAL_CURRENCY),
      tax: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
      netProfit: formatFinancialAmount(0, DEFAULT_LOCAL_CURRENCY),
    });
  }

  return yearlyReports.sort((a, b) => a.year - b.year);
};

function decorateLedgerRecords(
  ledgerRecords: IGetLedgerRecordsByDatesResult[],
  financialEntitiesDict: Map<string, IGetFinancialEntitiesByIdsResult>,
) {
  return ledgerRecords.map(record => {
    const sortCodes: LedgerRecordDecorations = {};
    if (record.credit_entity1) {
      const sortCode = financialEntitiesDict.get(record.credit_entity1)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.credit_entity1}`);
      }
      sortCodes.credit_entity_sort_code1 = sortCode ?? undefined;
    }
    if (record.credit_entity2) {
      const sortCode = financialEntitiesDict.get(record.credit_entity2)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.credit_entity2}`);
      }
      sortCodes.credit_entity_sort_code2 = sortCode ?? undefined;
    }
    if (record.debit_entity1) {
      const sortCode = financialEntitiesDict.get(record.debit_entity1)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.debit_entity1}`);
      }
      sortCodes.debit_entity_sort_code1 = sortCode ?? undefined;
    }
    if (record.debit_entity2) {
      const sortCode = financialEntitiesDict.get(record.debit_entity2)?.sort_code;
      if (!sortCode) {
        console.error(`No sort code for financial entity ${record.debit_entity2}`);
      }
      sortCodes.debit_entity_sort_code2 = sortCode ?? undefined;
    }
    return {
      ...record,
      ...sortCodes,
    };
  });
}

function amountBySortCodeValidation(
  records: DecoratedLedgerRecord[],
  validation: (sortCode: number) => boolean,
): number {
  let amount = 0;
  records.map(record => {
    if (record.credit_entity1 && validation(record.credit_entity_sort_code1!)) {
      amount += Number(record.credit_local_amount1);
    }
    if (record.credit_entity2 && validation(record.credit_entity_sort_code2!)) {
      amount += Number(record.credit_local_amount2);
    }
    if (record.debit_entity1 && validation(record.debit_entity_sort_code1!)) {
      amount -= Number(record.debit_local_amount1);
    }
    if (record.debit_entity2 && validation(record.debit_entity_sort_code2!)) {
      amount -= Number(record.debit_local_amount2);
    }
  });

  return amount;
}
