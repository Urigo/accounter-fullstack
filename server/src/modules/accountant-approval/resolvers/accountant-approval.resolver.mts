import type { IUpdateChargeParams } from '../../../__generated__/charges.types.mjs';
import { IUpdateLedgerRecordParams } from '../../../__generated__/ledger-records.types.mjs';
import { Resolvers } from '../../../__generated__/types.mjs';
import { getChargeByIdLoader, updateCharge } from '../../../providers/charges.mjs';
import { pool } from '../../../providers/db.mjs';
import {
  getLedgerRecordsByChargeIdLoader,
  updateLedgerRecord,
} from '../../../providers/ledger-records.mjs';

export const chargesResolvers: Resolvers = {
  Mutation: {
    toggleChargeAccountantApproval: async (_, { chargeId, approved }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: null,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: null,
        currencyRate: null,
        currentBalance: null,
        debitDate: null,
        detailedBankDescription: null,
        eventAmount: null,
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance: null,
        financialEntity: null,
        hashavshevetId: null,
        interest: null,
        isConversion: null,
        isProperty: null,
        links: null,
        originalId: null,
        personalCategory: null,
        proformaInvoiceFile: null,
        receiptDate: null,
        receiptImage: null,
        receiptNumber: null,
        receiptUrl: null,
        reviewed: approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: null,
        vat: null,
        withholdingTax: null,
        chargeId,
      };
      const res = await updateCharge.run({ ...adjustedFields }, pool);

      if (!res || res.length === 0) {
        throw new Error(`Failed to update charge ID='${chargeId}'`);
      }

      /* clear cache */
      if (res[0].original_id) {
        getChargeByIdLoader.clear(res[0].original_id);
      }
      return res[0].reviewed || false;
    },
    toggleLedgerRecordAccountantApproval: async (_, { ledgerRecordId, approved }) => {
      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccount1: null,
        creditAccount2: null,
        creditAmount1: null,
        creditAmount2: null,
        currency: null,
        date3: null,
        debitAccount1: null,
        debitAccount2: null,
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
      const res = await updateLedgerRecord.run({ ...adjustedFields }, pool);

      if (!res || res.length === 0) {
        throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
      }

      /* clear cache */
      if (res[0].original_id) {
        getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
      }
      return res[0].reviewed || false;
    },
  },
};
