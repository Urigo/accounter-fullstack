import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getForeignSecuritiesBusinessIds } from '../../foreign-securities/helpers/foreign-securities-businesses.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { IGetFinancialAccountsByAccountIDsResult } from '../types.js';

export async function getFinancialAccountByTransactionId(
  transactionId: string,
  injector: Injector,
): Promise<IGetFinancialAccountsByAccountIDsResult> {
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const transaction = await injector
    .get(TransactionsProvider)
    .transactionByIdLoader.load(transactionId);
  if (!transaction.account_id) {
    throw new Error(`Transaction ID="${transactionId}" is missing account_id`);
  }

  // The securities portfolio is one account whatever the counterparty is — the general
  // foreign-securities business or the specific security the trade was in.
  const foreignSecuritiesBusinessIds = await getForeignSecuritiesBusinessIds(injector);

  let account: IGetFinancialAccountsByAccountIDsResult | undefined;
  if (!!transaction.business_id && foreignSecuritiesBusinessIds.has(transaction.business_id)) {
    const accounts = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByOwnerIdLoader.load(ownerId);
    account = accounts.find(account => account.type === 'FOREIGN_SECURITIES');
  } else {
    account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
  }
  if (!account) {
    throw new Error(`Account ID "${transaction.account_id}" is missing`);
  }
  return account;
}
