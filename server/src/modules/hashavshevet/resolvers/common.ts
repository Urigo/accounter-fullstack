import type { HashavshevetModule } from '../types.js';

export const commonTransactionFields:
  | HashavshevetModule.ConversionTransactionResolvers
  | HashavshevetModule.FeeTransactionResolvers
  | HashavshevetModule.WireTransactionResolvers
  | HashavshevetModule.CommonTransactionResolvers = {
  // TODO(Gil): refactor according to new DB structure
  // hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
};
