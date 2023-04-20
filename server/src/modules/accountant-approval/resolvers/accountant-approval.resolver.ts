import type { ChargesTypes } from '@modules/charges';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import type { IUpdateLedgerRecordParams } from '@modules/ledger/types.js';
import type { AccountantApprovalModule } from '../types.js';

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
    toggleLedgerRecordAccountantApproval: async (_, { ledgerRecordId, approved }, { injector }) => {
      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccountID1: null,
        creditAccountID2: null,
        creditAmount1: null,
        creditAmount2: null,
        currency: null,
        date3: null,
        debitAccountID1: null,
        debitAccountID2: null,
        debitAmount1: null,
        debitAmount2: null,
        details: null,
        foreignCreditAmount1: null,
        foreignCreditAmount2: null,
        foreignDebitAmount1: null,
        foreignDebitAmount2: null,
        hashavshevetId: null,
        invoiceDate: null,
        movementType: null,
        origin: null,
        originalId: null,
        proformaInvoiceFile: null,
        reference1: null,
        reference2: null,
        reviewed: approved,
        valueDate: null,
      };
      const res = await injector.get(LedgerProvider).updateLedgerRecord({ ...adjustedFields });

      if (!res || res.length === 0) {
        throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
      }

      /* clear cache */
      if (res[0].original_id) {
        injector.get(LedgerProvider).getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
      }
      return res[0].reviewed || false;
    },
  },
  Charge: {
    accountantApproval: DbCharge => ({
      approved: DbCharge.accountant_reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
  },
  LedgerRecord: {
    accountantApproval: DbLedgerRecord => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
  },
};
