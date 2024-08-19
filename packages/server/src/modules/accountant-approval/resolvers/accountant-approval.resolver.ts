import { BusinessTripsTypes } from '@modules/business-trips/index.js';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { AccountantApprovalModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const accountantApprovalResolvers: AccountantApprovalModule.Resolvers = {
  Mutation: {
    updateChargeAccountantApproval: async (_, { chargeId, approvalStatus }, { injector }) => {
      const adjustedFields: ChargesTypes.IUpdateAccountantApprovalParams = {
        accountantStatus: approvalStatus,
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
      return res[0].accountant_status || 'UNAPPROVED';
    },
    updateBusinessTripAccountantApproval: async (
      _,
      { businessTripId, approvalStatus },
      { injector },
    ) => {
      const adjustedFields: BusinessTripsTypes.IUpdateAccountantApprovalParams = {
        accountantStatus: approvalStatus,
        businessTripId,
      };
      const res = await injector
        .get(BusinessTripsProvider)
        .updateAccountantApproval({ ...adjustedFields });

      if (!res || res.length === 0) {
        throw new Error(`Failed to update business trip ID='${businessTripId}'`);
      }

      return res[0].accountant_status || 'UNAPPROVED';
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
    accountantApproval: dbBusinessTrip => dbBusinessTrip.accountant_status ?? 'UNAPPROVED',
  },
};
