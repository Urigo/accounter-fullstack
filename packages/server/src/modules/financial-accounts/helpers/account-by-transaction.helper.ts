import type { Injector } from 'graphql-modules';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { IGetFinancialAccountsByAccountIDsResult } from '../types.js';

export async function getFinancialAccountByTransactionId(
  transactionId: string,
  injector: Injector,
): Promise<IGetFinancialAccountsByAccountIDsResult> {
  const transaction = await injector
    .get(TransactionsProvider)
    .transactionByIdLoader.load(transactionId);
  if (!transaction.account_id) {
    throw new Error(`Transaction ID="${transactionId}" is missing account_id`);
  }

  const account = await injector
    .get(FinancialAccountsProvider)
    .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
  if (!account) {
    throw new Error(`Account ID "${transaction.account_id}" is missing`);
  }
  return account;
}
