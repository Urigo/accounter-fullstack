import { BusinessTripsTypes } from '@modules/business-trips/index.js';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { AccountantApprovalModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const accountantApprovalResolvers: AccountantApprovalModule.Resolvers = {
  Mutation: {
    toggleChargeAccountantApproval: async (_, { chargeId, approved }, { injector }) => {
      const adjustedFields: ChargesTypes.IUpdateAccountantApprovalParams = {
        accountantReviewed: approved,
        chargeId,
      };
      const res = await injector
        .get(ChargesProvider)
        .updateAccountantApproval({ ...adjustedFields });

      if (!res || res.length === 0) {
        throw new Error(`Failed to update charge ID='${chargeId}'`);
      }

      /* clear cache */
      if (res[0].id) {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(res[0].id);
      }
      return res[0].accountant_reviewed || false;
    },
    toggleBusinessTripAccountantApproval: async (_, { businessTripId, approved }, { injector }) => {
      const adjustedFields: BusinessTripsTypes.IUpdateAccountantApprovalParams = {
        accountantReviewed: approved,
        businessTripId,
      };
      const res = await injector
        .get(BusinessTripsProvider)
        .updateAccountantApproval({ ...adjustedFields });

      if (!res || res.length === 0) {
        throw new Error(`Failed to update business trip ID='${businessTripId}'`);
      }

      return res[0].accountant_reviewed || false;
    },
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  BusinessTrip: {
    accountantApproval: dbBusinessTrip => dbBusinessTrip.accountant_reviewed ?? false,
  },
};
