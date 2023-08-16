import type { ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';

import type { FinancialEntitiesModule } from '../types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  linkedEntities: () => [], // TODO: implement
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

export const ledgerCounterparty = (account: 'CreditAccount1' | 'CreditAccount2' | 'DebitAccount1' | 'DebitAccount2'): ResolverFn<
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
> = (DbLedgerRecord) => { let counterpartyProto = undefined;
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
    }
  return resolverFn;
}
