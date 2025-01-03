import { BusinessTripsTypes } from '@modules/business-trips/index.js';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';

const commonChargeFields = {
  accountantApproval: (dbCharge: { accountant_status: any }) =>
    dbCharge.accountant_status ?? 'UNAPPROVED',
};

export const accountantApprovalSubgraphResolvers = {
  Mutation: {
    updateChargeAccountantApproval: async (
      _: any,
      { chargeId, approvalStatus }: any,
      { injector }: any,
    ) => {
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
      _: any,
      { businessTripId, approvalStatus }: any,
      { injector }: any,
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
    accountantApproval: (dbBusinessTrip: { accountant_status: any }) =>
      dbBusinessTrip.accountant_status ?? 'UNAPPROVED',
  },
};
