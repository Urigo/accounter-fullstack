import { GraphQLError } from 'graphql';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
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

export const commonChargeFields: FinancialEntitiesModule.ChargeResolvers = {
  counterparty: async (DbCharge, _, { injector }) =>
    DbCharge.business_id
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(DbCharge.business_id)
          .then(res => res ?? null)
      : null,
  owner: (DbCharge, _, { injector }) =>
    injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(DbCharge.owner_id)
      .then(res => {
        if (!res) {
          throw new Error(`Unable to find financial entity for charge ${DbCharge.owner_id}`);
        }
        return res;
      }),
};

export const commonTransactionFields:
  | FinancialEntitiesModule.ConversionTransactionResolvers
  | FinancialEntitiesModule.FeeTransactionResolvers
  | FinancialEntitiesModule.WireTransactionResolvers
  | FinancialEntitiesModule.CommonTransactionResolvers = {
  counterparty: (documentRoot, _, { injector }) =>
    documentRoot.business_id
      ? injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(documentRoot.business_id)
          .then(res => res ?? null)
      : null,
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
