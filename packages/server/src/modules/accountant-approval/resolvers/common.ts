import type { AccountantApprovalModule } from '../types.js';

export const commonChargeFields: AccountantApprovalModule.ChargeResolvers = {
  accountantApproval: DbCharge => DbCharge.accountant_reviewed ?? false,
};
