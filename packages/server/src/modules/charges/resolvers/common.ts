import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { calculateTotalAmount } from '../helpers/common.helper.js';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule } from '../types.js';

export async function safeGetChargeById(chargeId: string, injector: Injector) {
  return injector
    .get(ChargesProvider)
    .getChargeByIdLoader.load(chargeId)
    .catch(error => {
      console.error('Error loading charge by ID:', error);
      throw new GraphQLError('Error loading charge');
    });
}

export const commonChargeFields: ChargesModule.ChargeResolvers = {
  id: chargeId => chargeId,
  vat: async (chargeId, _, { injector }) => {
    const charge = await safeGetChargeById(chargeId, injector);
    return charge.documents_vat_amount != null && charge.documents_currency
      ? formatFinancialAmount(charge.documents_vat_amount, charge.documents_currency)
      : null;
  },
  totalAmount: async (chargeId, _, { adminContext: { defaultLocalCurrency }, injector }) => {
    const charge = await safeGetChargeById(chargeId, injector);
    return calculateTotalAmount(charge, defaultLocalCurrency);
  },
  property: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).is_property,
  conversion: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).type === 'CONVERSION',
  salary: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).type === 'PAYROLL',
  isInvoicePaymentDifferentCurrency: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).invoice_payment_currency_diff,
  userDescription: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).user_description,
  minEventDate: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).transactions_min_event_date,
  minDebitDate: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).transactions_min_debit_date,
  minDocumentsDate: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).documents_min_date,
  validationData: (chargeId, _, context) => validateCharge(chargeId, context),
  metadata: (chargeId, _, { injector }) => safeGetChargeById(chargeId, injector),
  yearsOfRelevance: async (chargeId, _, { injector }) => {
    const spreadRecords = await injector
      .get(ChargeSpreadProvider)
      .getChargeSpreadByChargeIdLoader.load(chargeId);
    return (
      spreadRecords?.map(record => ({
        year: dateToTimelessDateString(record.year_of_relevance),
        amount: record.amount ? Number(record.amount) : null,
      })) ?? null
    );
  },
  optionalVAT: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).optional_vat,
  optionalDocuments: async (chargeId, _, { injector }) =>
    (await safeGetChargeById(chargeId, injector)).documents_optional_flag,
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: documentRoot => documentRoot.charge_id,
};
