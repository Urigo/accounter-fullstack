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
