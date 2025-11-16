import { GraphQLError } from 'graphql';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { calculateTotalAmount } from '../helpers/common.helper.js';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult } from '../types.js';

export const commonChargeFields: ChargesModule.ChargeResolvers = {
  id: DbCharge => DbCharge.id,
  vat: DbCharge =>
    DbCharge.documents_vat_amount != null && DbCharge.documents_currency
      ? formatFinancialAmount(DbCharge.documents_vat_amount, DbCharge.documents_currency)
      : null,
  totalAmount: (dbCharge, _, { adminContext: { defaultLocalCurrency } }) =>
    calculateTotalAmount(dbCharge, defaultLocalCurrency),
  property: async (dbCharge, _, { injector }) => {
    try {
      const depreciation = await injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByChargeIdLoader.load(dbCharge.id);
      return depreciation.length > 0;
    } catch (error) {
      const message = `Failed to fetch depreciation records`;
      console.error(`${message} for charge ID=${dbCharge.id}: `, error);
      throw new GraphQLError(message);
    }
  },
  conversion: DbCharge => DbCharge.type === 'CONVERSION',
  salary: DbCharge => DbCharge.type === 'PAYROLL',
  isInvoicePaymentDifferentCurrency: DbCharge => DbCharge.invoice_payment_currency_diff,
  userDescription: DbCharge => DbCharge.user_description,
  minEventDate: DbCharge => DbCharge.transactions_min_event_date,
  minDebitDate: DbCharge => DbCharge.transactions_min_debit_date,
  minDocumentsDate: DbCharge => DbCharge.documents_min_date,
  validationData: (DbCharge, _, context) => validateCharge(DbCharge, context),
  metadata: DbCharge => DbCharge,
  yearsOfRelevance: async (DbCharge, _, { injector }) => {
    const spreadRecords = await injector
      .get(ChargeSpreadProvider)
      .getChargeSpreadByChargeIdLoader.load(DbCharge.id);
    return (
      spreadRecords?.map(record => ({
        year: dateToTimelessDateString(record.year_of_relevance),
        amount: record.amount ? Number(record.amount) : null,
      })) ?? null
    );
  },
  optionalVAT: DbCharge => DbCharge.optional_vat,
  optionalDocuments: DbCharge => DbCharge.documents_optional_flag,
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id) {
      return null;
    }
    const charge = await injector
      .get(ChargesProvider)
      .getChargeByIdLoader.load(documentRoot.charge_id);
    return charge ?? null;
  },
};
