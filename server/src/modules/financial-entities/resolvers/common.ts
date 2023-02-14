import type { FinancialEntitiesModule } from '../__generated__/types.js';

export const commonFinancialEntityFields:
  | FinancialEntitiesModule.LtdFinancialEntityResolvers
  | FinancialEntitiesModule.PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  linkedEntities: () => [], // TODO: implement
};
