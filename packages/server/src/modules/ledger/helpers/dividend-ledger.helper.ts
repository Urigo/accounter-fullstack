import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { splitFeeTransactions } from './fee-transactions.js';

export function splitDividendTransactions(
  transactions: Array<IGetTransactionsByChargeIdsResult>,
  context: GraphQLModules.Context,
) {
  const { dividendWithholdingTaxBusinessId, dividendPaymentBusinessIds } =
    context.adminContext.dividends;
  if (!dividendWithholdingTaxBusinessId) {
    throw new Error('Dividend withholding tax business ID is not set');
  }
  const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);
  const withholdingTaxTransactions = [];
  const paymentsTransactions = [];
  const errors: string[] = [];
  for (const transaction of mainTransactions) {
    if (transaction.business_id === dividendWithholdingTaxBusinessId) {
      withholdingTaxTransactions.push(transaction);
    } else if (dividendPaymentBusinessIds.includes(transaction.business_id as string)) {
      paymentsTransactions.push(transaction);
    } else {
      errors.push(`Transaction ID: ${transaction.id} is not a dividend transaction`);
    }
  }
  return { withholdingTaxTransactions, paymentsTransactions, feeTransactions, errors };
}
