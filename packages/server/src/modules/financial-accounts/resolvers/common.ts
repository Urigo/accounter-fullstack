import type { PrivateOrBusinessType } from '../../../__generated__/types.js';
import { Currency } from '../../../shared/enums.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { getFinancialAccountByTransactionId } from '../helpers/account-by-transaction.helper.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import type { FinancialAccountsModule } from '../types.js';

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
  account: async (transactionId, _, { injector, adminContext }) => {
    return getFinancialAccountByTransactionId(transactionId, injector, adminContext);
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
