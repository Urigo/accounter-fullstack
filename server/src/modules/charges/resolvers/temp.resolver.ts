import { TempProvider } from '../providers/temp.provider.js';
import type { ChargesModule } from '../types.js';

const commonChargeFields: ChargesModule.ChargeResolvers = {
  oldLedger: async (charge, _, { injector }) => {
    const ledger = await injector.get(TempProvider).getOldLedgerByChargeIdsLoader.load(charge.id);
    return ledger.map(l => ({
      business: l.business,
      creditAccount1: l.credit_account_1,
      creditAccount2: l.credit_account_2,
      creditAmount1: l.credit_amount_1,
      creditAmount2: l.credit_amount_2,
      currency: l.currency,
      date3: l.date_3,
      debitAccount1: l.debit_account_1,
      debitAccount2: l.debit_account_2,
      debitAmount1: l.debit_amount_1,
      debitAmount2: l.debit_amount_2,
      details: l.details,
      foreignCreditAmount1: l.foreign_credit_amount_1,
      foreignCreditAmount2: l.foreign_credit_amount_2,
      foreignDebitAmount1: l.foreign_debit_amount_1,
      foreignDebitAmount2: l.foreign_debit_amount_2,
      hashavshevetId: l.hashavshevet_id,
      id: l.id,
      invoiceDate: l.invoice_date,
      movementType: l.movement_type,
      origin: l.origin,
      originalId: l.original_id,
      proformaInvoiceFile: l.proforma_invoice_file,
      reference1: l.reference_1,
      reference2: l.reference_2,
      reviewed: l.reviewed,
      valueDate: l.value_date,
    }));
  },
};

export const tempResolvers: ChargesModule.Resolvers = {
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
};
