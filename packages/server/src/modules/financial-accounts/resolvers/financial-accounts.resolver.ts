import { GraphQLError } from 'graphql';
import type { Writeable } from '../../../shared/types/index.js';
import { FinancialAccountsTaxCategoriesProvider } from '../providers/financial-accounts-tax-categories.provider.js';
import { FinancialAccountsProvider } from '../providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../providers/financial-bank-accounts.provider.js';
import type {
  FinancialAccountsModule,
  IInsertFinancialAccountsParams,
  IInsertFinancialAccountTaxCategoriesParams,
  IUpdateFinancialAccountParams,
} from '../types.js';
import {
  commonFinancialAccountFields,
  commonFinancialEntityFields,
  commonTransactionFields,
} from './common.js';

export const financialAccountsResolvers: FinancialAccountsModule.Resolvers = {
  Query: {
    allFinancialAccounts: async (_, __, { injector }) => {
      return injector.get(FinancialAccountsProvider).getAllFinancialAccounts();
    },
    financialAccountsByOwner: async (_, { ownerId }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountsByOwnerIdLoader.load(ownerId);
    },
    financialAccount: async (_, { id }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(id)
        .then(account => {
          if (!account) {
            throw new GraphQLError('Financial account not found');
          }
          return account;
        });
    },
  },
  Mutation: {
    deleteFinancialAccount: async (_, { id }, { injector }) => {
      return injector
        .get(FinancialAccountsProvider)
        .deleteFinancialAccount({ financialAccountId: id })
        .then(() => true);
    },
    createFinancialAccount: async (_, { input }, { injector }) => {
      try {
        const bankAccount: IInsertFinancialAccountsParams['bankAccounts'][number] = {
          accountNumber: input.number,
          name: input.name,
          privateBusiness: input.privateOrBusiness,
          ownerId: input.ownerId,
          type: input.type,
        };
        const [account] = await injector
          .get(FinancialAccountsProvider)
          .insertFinancialAccounts({ bankAccounts: [bankAccount] });

        if (
          input.bankAccountDetails &&
          Object.values(input.bankAccountDetails).some(v => v != null)
        ) {
          await injector.get(FinancialBankAccountsProvider).insertBankAccounts({
            bankAccounts: [
              {
                bankNumber: input.bankAccountDetails.bankNumber,
                branchNumber: input.bankAccountDetails.branchNumber,
                iban: input.bankAccountDetails.iban,
                swiftCode: input.bankAccountDetails.swiftCode,
                extendedBankNumber: input.bankAccountDetails.extendedBankNumber,
                partyPreferredIndication: input.bankAccountDetails.partyPreferredIndication,
                partyAccountInvolvementCode: input.bankAccountDetails.partyAccountInvolvementCode,
                accountDealDate: input.bankAccountDetails.accountDealDate,
                accountUpdateDate: input.bankAccountDetails.accountUpdateDate,
                metegDoarNet: input.bankAccountDetails.metegDoarNet,
                kodHarshaatPeilut: input.bankAccountDetails.kodHarshaatPeilut,
                accountClosingReasonCode: input.bankAccountDetails.accountClosingReasonCode,
                accountAgreementOpeningDate: input.bankAccountDetails.accountAgreementOpeningDate,
                serviceAuthorizationDesc: input.bankAccountDetails.serviceAuthorizationDesc,
                branchTypeCode: input.bankAccountDetails.branchTypeCode,
                mymailEntitlementSwitch: input.bankAccountDetails.mymailEntitlementSwitch,
                productLabel: input.bankAccountDetails.productLabel,
              },
            ],
          });
        }

        if (input.currencies && input.currencies.length > 0) {
          await injector
            .get(FinancialAccountsTaxCategoriesProvider)
            .insertFinancialAccountTaxCategories({
              financialAccountsTaxCategories: input.currencies.map(c => ({
                financial_account_id: account.id,
                currency: c.currency,
                tax_category_id: c.taxCategoryId,
              })),
            });
        }

        return account;
      } catch (error) {
        const message = 'Failed to create financial account';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    updateFinancialAccount: async (_, { id, fields }, { injector }) => {
      try {
        const updatedAccount: IUpdateFinancialAccountParams = {
          financialAccountId: id,
          accountNumber: fields.number,
          ownerId: fields.ownerId,
          privateBusiness: fields.privateOrBusiness,
          type: fields.type,
        };
        const account = await injector
          .get(FinancialAccountsProvider)
          .updateFinancialAccount(updatedAccount);

        if (
          fields.bankAccountDetails &&
          Object.values(fields.bankAccountDetails).some(v => v != null)
        ) {
          await injector.get(FinancialBankAccountsProvider).updateBankAccount({
            bankAccountId: id,
            accountAgreementOpeningDate: fields.bankAccountDetails.accountAgreementOpeningDate,
            accountClosingReasonCode: fields.bankAccountDetails.accountClosingReasonCode,
            accountDealDate: fields.bankAccountDetails.accountDealDate,
            accountUpdateDate: fields.bankAccountDetails.accountUpdateDate,
            bankNumber: fields.bankAccountDetails.bankNumber,
            branchNumber: fields.bankAccountDetails.branchNumber,
            branchTypeCode: fields.bankAccountDetails.branchTypeCode,
            extendedBankNumber: fields.bankAccountDetails.extendedBankNumber,
            iban: fields.bankAccountDetails.iban,
            swiftCode: fields.bankAccountDetails.swiftCode,
            kodHarshaatPeilut: fields.bankAccountDetails.kodHarshaatPeilut,
            metegDoarNet: fields.bankAccountDetails.metegDoarNet,
            mymailEntitlementSwitch: fields.bankAccountDetails.mymailEntitlementSwitch,
            partyAccountInvolvementCode: fields.bankAccountDetails.partyAccountInvolvementCode,
            partyPreferredIndication: fields.bankAccountDetails.partyPreferredIndication,
            productLabel: fields.bankAccountDetails.productLabel,
            serviceAuthorizationDesc: fields.bankAccountDetails.serviceAuthorizationDesc,
          });
        }

        if (fields.currencies && fields.currencies.length > 0) {
          const currentTaxCategories = await injector
            .get(FinancialAccountsTaxCategoriesProvider)
            .getFinancialAccountTaxCategoriesByFinancialAccountIdLoader.load(account.id);

          if (currentTaxCategories.length > 0) {
            const updateTaxCategories: Promise<unknown>[] = [];

            // check for tax categories to delete - those that exist currently but are not included in the input
            const taxCategoriesToDelete = currentTaxCategories.filter(
              ctc =>
                !fields.currencies!.some(
                  inputTaxCategory => inputTaxCategory.currency === ctc.currency,
                ),
            );
            if (taxCategoriesToDelete.length > 0) {
              updateTaxCategories.push(
                injector
                  .get(FinancialAccountsTaxCategoriesProvider)
                  .deleteFinancialAccountTaxCategories({
                    financialAccountId: account.id,
                    currencies: taxCategoriesToDelete.map(tc => tc.currency),
                  }),
              );
            }

            const taxCategoriesToInsert: Writeable<
              IInsertFinancialAccountTaxCategoriesParams['financialAccountsTaxCategories']
            > = [];
            fields.currencies.map(inputTaxCategory => {
              const currentTaxCategory = currentTaxCategories.find(
                ctc => ctc.currency === inputTaxCategory.currency,
              );
              if (currentTaxCategory) {
                if (currentTaxCategory.tax_category_id !== inputTaxCategory.taxCategoryId) {
                  // tax category changed for this currency, update it
                }
                updateTaxCategories.push(
                  injector
                    .get(FinancialAccountsTaxCategoriesProvider)
                    .updateFinancialAccountTaxCategory({
                      financialAccountId: account.id,
                      currency: inputTaxCategory.currency,
                      taxCategoryId: inputTaxCategory.taxCategoryId,
                    }),
                );
              } else {
                // new tax category for this account, insert it
                taxCategoriesToInsert.push({
                  financial_account_id: account.id,
                  currency: inputTaxCategory.currency,
                  tax_category_id: inputTaxCategory.taxCategoryId,
                });
              }
            });
            if (taxCategoriesToInsert.length > 0) {
              updateTaxCategories.push(
                injector
                  .get(FinancialAccountsTaxCategoriesProvider)
                  .insertFinancialAccountTaxCategories({
                    financialAccountsTaxCategories: taxCategoriesToInsert,
                  }),
              );
            }

            await Promise.all(updateTaxCategories);
          } else {
            // none existing,insert all
            await injector
              .get(FinancialAccountsTaxCategoriesProvider)
              .insertFinancialAccountTaxCategories({
                financialAccountsTaxCategories: fields.currencies.map(c => ({
                  financial_account_id: account.id,
                  currency: c.currency,
                  tax_category_id: c.taxCategoryId,
                })),
              });
          }
        }

        return account;
      } catch (error) {
        const message = 'Failed to update financial account';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
  CardFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CREDIT_CARD',
    ...commonFinancialAccountFields,
    fourDigits: DbAccount => DbAccount.account_number,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
  },
  CryptoWalletFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'CRYPTO_WALLET',
    ...commonFinancialAccountFields,
    name: DbAccount =>
      DbAccount.account_name ??
      (DbAccount.account_number.length >= 20
        ? DbAccount.account_number.slice(-8)
        : DbAccount.account_number),
  },
  ForeignSecuritiesFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'FOREIGN_SECURITIES',
    ...commonFinancialAccountFields,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
  },
  BankDepositFinancialAccount: {
    __isTypeOf: DbAccount => DbAccount.type === 'BANK_DEPOSIT_ACCOUNT',
    ...commonFinancialAccountFields,
    name: DbAccount => DbAccount.account_name ?? DbAccount.account_number,
  },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
