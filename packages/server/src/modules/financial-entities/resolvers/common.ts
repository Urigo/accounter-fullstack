import { GraphQLError } from 'graphql';
import { getChargeBusinesses } from '@modules/charges/helpers/charge-summaries.helper.js';
import { safeGetChargeTempById } from '@modules/charges/resolvers/common.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: dbFinancialEntity => dbFinancialEntity.id,
  name: dbFinancialEntity => dbFinancialEntity.name,
  irsCode: dbFinancialEntity => dbFinancialEntity.irs_code,
  isActive: dbFinancialEntity => !!dbFinancialEntity.is_active,
  createdAt: dbFinancialEntity => dbFinancialEntity.created_at,
  updatedAt: dbFinancialEntity => dbFinancialEntity.updated_at,
};

export const commonTaxChargeFields: FinancialEntitiesModule.ChargeResolvers = {
  taxCategory: async (chargeId, _, { injector }) => {
    const charge = await safeGetChargeTempById(chargeId, injector);
    if (charge.tax_category_id) {
      return injector
        .get(TaxCategoriesProvider)
        .taxCategoryByIdLoader.load(charge.tax_category_id)
        .then(taxCategory => taxCategory ?? null);
    }
    return injector
      .get(TaxCategoriesProvider)
      .taxCategoryByChargeIDsLoader.load(chargeId)
      .then(taxCategory => taxCategory ?? null);
  },
};

export const commonChargeFields: FinancialEntitiesModule.ChargeResolvers = {
  counterparty: async (chargeId, _, { injector }) => {
    const { mainBusiness } = await getChargeBusinesses(chargeId, injector);
    return mainBusiness
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(mainBusiness)
          .then(res => res ?? null)
      : null;
  },
  owner: async (chargeId, _, { injector }) => {
    const charge = await safeGetChargeTempById(chargeId, injector);
    return injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(charge.owner_id)
      .then(res => {
        if (!res) {
          throw new Error(`Unable to find financial entity for charge ${charge.owner_id}`);
        }
        return res;
      });
  },
};

export const commonTransactionFields:
  | FinancialEntitiesModule.ConversionTransactionResolvers
  | FinancialEntitiesModule.CommonTransactionResolvers = {
  counterparty: async (transactionId, _, { injector }) => {
    const transaction = await injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId);
    if (!transaction.business_id) {
      return null;
    }

    return injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.load(transaction.business_id)
      .then(res => res ?? null);
  },
};

export const commonDocumentsFields: FinancialEntitiesModule.FinancialDocumentResolvers = {
  creditor: (documentRoot, _, { injector }) =>
    documentRoot.creditor_id
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(documentRoot.creditor_id)
          .then(res => res ?? null)
      : null,
  debtor: (documentRoot, _, { injector }) =>
    documentRoot.debtor_id
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(documentRoot.debtor_id)
          .then(res => res ?? null)
      : null,
};

export const ledgerCounterparty = (
  account: 'CreditAccount1' | 'CreditAccount2' | 'DebitAccount1' | 'DebitAccount2',
): ResolverFn<
  Maybe<ResolversTypes['FinancialEntity']>,
  ResolversParentTypes['LedgerRecord'],
  GraphQLModules.Context,
  object
> => {
  const resolverFn: ResolverFn<
    Maybe<ResolversTypes['FinancialEntity']>,
    ResolversParentTypes['LedgerRecord'],
    GraphQLModules.Context,
    object
  > = (DbLedgerRecord, _, { injector }) => {
    let financialEntityId: string | null = null;
    switch (account) {
      case 'CreditAccount1':
        financialEntityId = DbLedgerRecord.credit_entity1;
        break;
      case 'CreditAccount2':
        financialEntityId = DbLedgerRecord.credit_entity2;
        break;
      case 'DebitAccount1':
        financialEntityId = DbLedgerRecord.debit_entity1;
        break;
      case 'DebitAccount2':
        financialEntityId = DbLedgerRecord.debit_entity2;
        break;
      default:
        throw new Error(`Invalid account type: ${account}`);
    }

    return financialEntityId
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(financialEntityId)
          .then(res => {
            if (!res) {
              throw new GraphQLError(`Financial entity ID="${financialEntityId}" not found`);
            }
            return res;
          })
      : null;
  };
  return resolverFn;
};
