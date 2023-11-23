import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { AccountantApprovalModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const accountantApprovalResolvers: AccountantApprovalModule.Resolvers = {
  Mutation: {
    toggleChargeAccountantApproval: async (_, { chargeId, approved }, { injector }) => {
      const adjustedFields: ChargesTypes.IUpdateChargeParams = {
        accountantReviewed: approved,
        chargeId,
        isConversion: null,
        isProperty: null,
        ownerId: null,
        userDescription: null,
      };
      const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });

      if (!res || res.length === 0) {
        throw new Error(`Failed to update charge ID='${chargeId}'`);
      }

      /* clear cache */
      if (res[0].id) {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(res[0].id);
      }
      return res[0].accountant_reviewed || false;
    },
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
};
