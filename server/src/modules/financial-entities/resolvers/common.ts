import type { FinancialEntitiesModule } from '../types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  linkedEntities: () => [], // TODO: implement
};
