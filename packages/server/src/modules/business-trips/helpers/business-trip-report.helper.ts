import { GraphQLError } from 'graphql';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import {
  Currency,
  type BusinessTripSummaryCategories,
  type BusinessTripSummaryRow,
} from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { currency, IGetBusinessTripsTransactionsByBusinessTripIdsResult } from '../types.js';

export type SummaryCategoryData = { [key in Currency]?: { total: number; taxable: number } };
export type SummaryData = Record<BusinessTripSummaryCategories, SummaryCategoryData>;

export function convertSummaryCategoryDataToRow(
  category: BusinessTripSummaryCategories,
  data: SummaryCategoryData,
): BusinessTripSummaryRow {
  return {
    type: category,
    totalForeignCurrencies: Object.entries(data)
      .filter(row => row[0] !== Currency.Ils)
      .map(([currency, { total }]) => formatFinancialAmount(total, currency)),
    taxableForeignCurrencies: Object.entries(data)
      .filter(row => row[0] !== Currency.Ils)
      .map(([currency, { taxable }]) => formatFinancialAmount(taxable, currency)),
    totalLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.total ?? 0, Currency.Ils),
    taxableLocalCurrency: formatFinancialAmount(data[Currency.Ils]?.taxable ?? 0, Currency.Ils),
    excessExpenditure: formatFinancialAmount(0, Currency.Ils),
  };
}

export function calculateTotalReportSummaryCategory(data: Partial<SummaryData>) {
  const totalSumCategory = Object.values(data).reduce((acc, category) => {
    Object.entries(category).map(([currency, { total, taxable }]) => {
      acc[currency as Currency] ||= { total: 0, taxable: 0 };
      acc[currency as Currency]!.total += total;
      acc[currency as Currency]!.taxable += taxable;
    });
    return acc;
  }, {});
  return totalSumCategory;
}

export async function summaryCategoryDataCollector(
  businessTripTransactions: IGetBusinessTripsTransactionsByBusinessTripIdsResult,
  partialData: Partial<SummaryData>,
  categoryName: BusinessTripSummaryCategories,
  transactions: IGetTransactionsByIdsResult[],
): Promise<void> {
  // populate category
  partialData[categoryName] ??= {};
  const category = partialData[categoryName] as SummaryCategoryData;

  // get currency and amount
  let currency: currency | null = businessTripTransactions.currency;
  let amount = businessTripTransactions.amount ? Number(businessTripTransactions.amount) : null;
  if (!currency && businessTripTransactions.transaction_id) {
    const matchingTransaction = transactions.find(
      t => t.id === businessTripTransactions.transaction_id,
    );
    currency = matchingTransaction?.currency || null;
    amount = matchingTransaction?.amount ? Number(matchingTransaction.amount) : null;
  }

  if (!currency) {
    throw new GraphQLError(
      `Currency not found for flight transaction ID ${businessTripTransactions.id}`,
    );
  }
  if (amount === null) {
    throw new GraphQLError(
      `Amount not found for flight transaction ID ${businessTripTransactions.id}`,
    );
  }

  // populate currency
  category[currency] ||= { total: 0, taxable: 0 };

  // update amounts
  category[currency]!.total += amount;
  category[currency]!.taxable += amount;
}
