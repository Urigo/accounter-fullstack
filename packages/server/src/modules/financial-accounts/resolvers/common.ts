import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency } from '@shared/enums';
import type { PrivateOrBusinessType } from '@shared/gql-types';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule, IGetFinancialAccountsByAccountIDsResult } from '../types.js';

function getPrivateOrBusinessType(privateOrBusiness: string): PrivateOrBusinessType {
  switch (privateOrBusiness) {
    case 'PRIVATE':
      return 'PRIVATE';
    case 'BUSINESS':
      return 'BUSINESS';
    default:
      throw new Error(`Unknown privateOrBusiness type: ${privateOrBusiness}`);
  }
}

export const commonFinancialAccountFields: FinancialAccountsModule.FinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
  type: DbAccount => DbAccount.type,
  number: DbAccount => DbAccount.account_number,
  privateOrBusiness: DbAccount => getPrivateOrBusinessType(DbAccount.private_business),
  accountTaxCategories: async (DbAccount, _, { injector }) => {
    const taxCategories = await injector
      .get(TaxCategoriesProvider)
      .taxCategoryByFinancialAccountIdsLoader.load(DbAccount.id)
      .then(categories => {
        return categories.map(category => ({
          id: `${DbAccount.id}-${category.currency}`,
          currency: category.currency as Currency,
          taxCategory: category,
        }));
      });
    return taxCategories;
  },
};

export const commonTransactionFields:
  | FinancialAccountsModule.ConversionTransactionResolvers
  | FinancialAccountsModule.CommonTransactionResolvers = {
  account: async (
    transactionId,
    _,
    {
      injector,
      adminContext: {
        defaultAdminBusinessId,
        foreignSecurities: { foreignSecuritiesBusinessId },
      },
    },
  ) => {
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
  },
};

export const commonFinancialEntityFields:
  | FinancialAccountsModule.LtdFinancialEntityResolvers
  | FinancialAccountsModule.PersonalFinancialEntityResolvers = {
  accounts: async (DbBusiness, _, { injector }) => {
    const accounts = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountsByOwnerIdLoader.load(DbBusiness.id);
    return accounts;
  },
};
