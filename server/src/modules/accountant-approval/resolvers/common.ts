import { AccountantApprovalModule } from '../types.js';

export const commonChargeFields: AccountantApprovalModule.ChargeResolvers = {
  accountantApproval: DbCharge => ({
    approved: DbCharge.accountant_reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
};
