import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { IGetFinancialAccountsByAccountIDsResult } from '../types.js';

export async function getFinancialAccountByTransactionId(
  transactionId: string,
  injector: Injector,
): Promise<IGetFinancialAccountsByAccountIDsResult> {
  const {
    ownerId,
    foreignSecurities: { foreignSecuritiesBusinessId },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const transaction = await injector
    .get(TransactionsProvider)
    .transactionByIdLoader.load(transactionId);
  if (!transaction.account_id) {
    throw new Error(`Transaction ID="${transactionId}" is missing account_id`);
  }

  let account: IGetFinancialAccountsByAccountIDsResult | undefined = undefined;
  if (!!foreignSecuritiesBusinessId && transaction.business_id === foreignSecuritiesBusinessId) {
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
