import type { HashavshevetModule } from '../types.js';

export const commonTransactionFields:
  | HashavshevetModule.ConversionTransactionResolvers
  | HashavshevetModule.FeeTransactionResolvers
  | HashavshevetModule.WireTransactionResolvers
  | HashavshevetModule.CommonTransactionResolvers = {
  hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
};
