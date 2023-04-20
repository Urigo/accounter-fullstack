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
