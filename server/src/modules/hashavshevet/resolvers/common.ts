import type { HashavshevetModule } from '../__generated__/types.js';

export const commonTransactionFields:
  | HashavshevetModule.ConversionTransactionResolvers
  | HashavshevetModule.FeeTransactionResolvers
  | HashavshevetModule.WireTransactionResolvers
  | HashavshevetModule.CommonTransactionResolvers = {
  hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
};
