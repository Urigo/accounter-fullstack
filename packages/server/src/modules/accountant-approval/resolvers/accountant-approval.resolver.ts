import { GraphQLError } from 'graphql';
import { BusinessTripsTypes } from '@modules/business-trips/index.js';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { AccountantApprovalProvider } from '../providers/accountant-approval.provider.js';
import type { AccountantApprovalModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const accountantApprovalResolvers: AccountantApprovalModule.Resolvers = {
  Query: {
    accountantApprovalStatus: async (
      _,
      { from, to },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        const statuses = await injector.get(AccountantApprovalProvider).getChargesApprovalStatus({
          fromDate: from,
          toDate: to,
          ownerIds: [defaultAdminBusinessId],
        });
        if (!statuses || statuses.length === 0) {
          throw new GraphQLError('No charges found for the specified date range');
        }
        const status = statuses[0];
        return {
          totalCharges: parseInt(status.total_charges ?? '0', 10),
          approvedCount: parseInt(status.approved_charges ?? '0', 10),
          pendingCount: parseInt(status.pending_charges ?? '0', 10),
          unapprovedCount: parseInt(status.unapproved_charges ?? '0', 10),
        };
      } catch (error) {
        console.error('Error fetching accountant approval status:', error);
        throw new GraphQLError('Failed to fetch accountant approval status');
      }
    },
  },
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
  ForeignSecuritiesCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
  BusinessTrip: {
    accountantApproval: dbBusinessTrip => dbBusinessTrip.accountant_status ?? 'UNAPPROVED',
  },
};
