import type { ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  linkedEntities: () => [], // TODO: implement
};

export const commonTaxChargeFields: FinancialEntitiesModule.ChargeResolvers = {
  taxCategory: async (DbCharge, _, { injector }) => {
    if (!DbCharge.tax_category_id) {
      return null;
    }
    return injector
      .get(TaxCategoriesProvider)
      .taxCategoryByIDsLoader.load(DbCharge.tax_category_id)
      .then(taxCategory => taxCategory ?? null);
  },
};

export const commonChargeFields: FinancialEntitiesModule.CommonChargeResolvers = {
  counterparty: async DbCharge => {
    return DbCharge.business_id;
  },
  beneficiaries: () => [],
  // async (DbCharge, _, { injector }) => {
  //   // TODO: update to better implementation after DB is updated
  //   try {
  //     if (DbCharge.financial_accounts_to_balance) {
  //       return JSON.parse(DbCharge.financial_accounts_to_balance);
  //     }
  //   } catch {
  //     null;
  //   }
  //   switch (DbCharge.financial_accounts_to_balance) {
  //     case 'no':
  //       return [
  //         {
  //           counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
  //           percentage: 0.5,
  //         },
  //         {
  //           counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
  //           percentage: 0.5,
  //         },
  //       ];
  //     case 'uri':
  //       return [
  //         {
  //           counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
  //           percentage: 1,
  //         },
  //       ];
  //     case 'dotan':
  //       return [
  //         {
  //           counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
  //           percentage: 1,
  //         },
  //       ];
  //     default:
  //       {
  //         // case Guild account
  //         const guildAccounts = await injector
  //           .get(FinancialAccountsProvider)
  //           .getFinancialAccountsByFinancialEntityIdLoader.load(
  //             '6a20aa69-57ff-446e-8d6a-1e96d095e988',
  //           );
  //         const guildAccountsNumbers = guildAccounts.map(a => a.account_number);
  //         if (guildAccountsNumbers.includes(DbCharge.account_number)) {
  //           return [
  //             {
  //               counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
  //               percentage: 0.5,
  //             },
  //             {
  //               counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
  //               percentage: 0.5,
  //             },
  //           ];
  //         }

  //         // case UriLTD account
  //         const uriAccounts = await injector
  //           .get(FinancialAccountsProvider)
  //           .getFinancialAccountsByFinancialEntityIdLoader.load(
  //             'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
  //           );
  //         const uriAccountsNumbers = uriAccounts.map(a => a.account_number);
  //         if (uriAccountsNumbers.includes(DbCharge.account_number)) {
  //           return [
  //             {
  //               counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
  //               percentage: 1,
  //             },
  //           ];
  //         }
  //       }
  //       return [];
  //   }
  // },
  owner: (DbCharge, _, { injector }) =>
    injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByChargeIdsLoader.load(DbCharge.id)
      .then(res => {
        if (!res) {
          throw new Error(`Unable to find financial entity for charge ${DbCharge.id}`);
        }
        return res;
      }),
};

export const commonTransactionFields:
  | FinancialEntitiesModule.ConversionTransactionResolvers
  | FinancialEntitiesModule.FeeTransactionResolvers
  | FinancialEntitiesModule.WireTransactionResolvers
  | FinancialEntitiesModule.CommonTransactionResolvers = {
  counterparty: DbTransaction => DbTransaction.business_id,
};

export const commonDocumentsFields: FinancialEntitiesModule.DocumentResolvers = {
  creditor: documentRoot => documentRoot.creditor_id,
  debtor: documentRoot => documentRoot.debtor_id,
};

export const ledgerCounterparty = (
  account: 'CreditAccount1' | 'CreditAccount2' | 'DebitAccount1' | 'DebitAccount2',
): ResolverFn<
  ResolversTypes['Counterparty'],
  ResolversParentTypes['LedgerRecord'],
  GraphQLModules.Context,
  object
> => {
  const resolverFn: ResolverFn<
    ResolversTypes['Counterparty'],
    ResolversParentTypes['LedgerRecord'],
    GraphQLModules.Context,
    object
  > = DbLedgerRecord => {
    let counterpartyProto = undefined;
    switch (account) {
      case 'CreditAccount1':
        counterpartyProto = DbLedgerRecord.creditAccountID1;
        break;
      case 'CreditAccount2':
        counterpartyProto = DbLedgerRecord.creditAccountID2;
        break;
      case 'DebitAccount1':
        counterpartyProto = DbLedgerRecord.debitAccountID1;
        break;
      case 'DebitAccount2':
        counterpartyProto = DbLedgerRecord.debitAccountID2;
        break;
      default:
        throw new Error(`Invalid account type: ${account}`);
    }

    return counterpartyProto ?? null;
  };
  return resolverFn;
};
