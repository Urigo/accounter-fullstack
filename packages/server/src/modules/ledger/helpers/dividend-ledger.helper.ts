import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import {
  DIVIDEND_PAYMENT_BUSINESS_IDS,
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
} from '@shared/constants';
import { splitFeeTransactions } from './fee-transactions.js';

export function splitDividendTransactions(transactions: Array<IGetTransactionsByChargeIdsResult>) {
  const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);
  const withholdingTaxTransactions = [];
  const paymentsTransactions = [];
  const errors: string[] = [];
  for (const transaction of mainTransactions) {
    if (transaction.business_id === DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID) {
      withholdingTaxTransactions.push(transaction);
    } else if (DIVIDEND_PAYMENT_BUSINESS_IDS.includes(transaction.business_id as string)) {
      paymentsTransactions.push(transaction);
    } else {
      errors.push(`Transaction ID: ${transaction.id} is not a dividend transaction`);
    }
  }
  return { withholdingTaxTransactions, paymentsTransactions, feeTransactions, errors };
}
