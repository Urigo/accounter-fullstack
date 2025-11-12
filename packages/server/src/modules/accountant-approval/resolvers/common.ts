import { safeGetChargeById } from '@modules/charges/resolvers/common.js';
import type { AccountantApprovalModule } from '../types.js';

export const commonChargeFields: AccountantApprovalModule.ChargeResolvers = {
  accountantApproval: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).accountant_status ?? 'UNAPPROVED',
};
