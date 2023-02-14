import type { AccountantApprovalModule } from '../__generated__/types.js';

export const commonTransactionFields:
  | AccountantApprovalModule.ConversionTransactionResolvers
  | AccountantApprovalModule.FeeTransactionResolvers
  | AccountantApprovalModule.WireTransactionResolvers
  | AccountantApprovalModule.CommonTransactionResolvers = {
  accountantApproval: DbTransaction => ({
    approved: DbTransaction.reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
};
