import type { Injector } from 'graphql-modules';
import type { AdminContext } from '../../../plugins/admin-context-plugin.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { IGetFinancialAccountsByAccountIDsResult } from '../types.js';

export async function getFinancialAccountByTransactionId(
  transactionId: string,
  injector: Injector,
  context: AdminContext,
): Promise<IGetFinancialAccountsByAccountIDsResult> {
  const {
    defaultAdminBusinessId,
    foreignSecurities: { foreignSecuritiesBusinessId },
  } = context;
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
      .getFinancialAccountsByOwnerIdLoader.load(defaultAdminBusinessId);
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
