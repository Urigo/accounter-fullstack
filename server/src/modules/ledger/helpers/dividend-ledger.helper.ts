import { GraphQLError } from 'graphql';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import {
  DIVIDEND_PAYMENT_BUSINESS_IDS,
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
} from '@shared/constants';

export function splitDividendTransactions(transactions: Array<IGetTransactionsByChargeIdsResult>) {
  const withholdingTaxTransactions = [];
  const paymentsTransactions = [];
  for (const transaction of transactions) {
    if (transaction.business_id === DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID) {
      withholdingTaxTransactions.push(transaction);
    } else if (DIVIDEND_PAYMENT_BUSINESS_IDS.includes(transaction.business_id as string)) {
      paymentsTransactions.push(transaction);
    } else {
      throw new GraphQLError(`Transaction ID: ${transaction.id} is not a dividend transaction`);
    }
  }
  return { withholdingTaxTransactions, paymentsTransactions };
}
