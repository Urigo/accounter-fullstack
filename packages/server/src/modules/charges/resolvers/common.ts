import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { getDocumentsMinDate } from '@modules/documents/helpers/dates.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import {
  getTransactionsMinDebitDate,
  getTransactionsMinEventDate,
} from '@modules/transactions/helpers/debit-date.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import {
  getChargeDocumentsAmounts,
  getChargeTransactionsAmounts,
} from '../helpers/charge-summaries.helper.js';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesTempProvider } from '../providers/charges-temp.provider.js';
import type { ChargesModule } from '../types.js';

export async function safeGetChargeTempById(chargeId: string, injector: Injector) {
  return injector
    .get(ChargesTempProvider)
    .getChargeByIdLoader.load(chargeId)
    .catch(error => {
      console.error('Error loading charge by ID:', error);
      throw new GraphQLError('Error loading charge');
    });
}

export const commonChargeFields: ChargesModule.ChargeResolvers = {
  id: chargeId => chargeId,
  vat: async (chargeId, _, { injector }) => {
    const { currencies, invoiceVatAmount } = await getChargeDocumentsAmounts(chargeId, injector);
    return invoiceVatAmount != null && currencies.length === 1
      ? formatFinancialAmount(invoiceVatAmount, currencies[0])
      : null;
  },
  totalAmount: async (chargeId, _, { adminContext: { defaultLocalCurrency }, injector }) => {
    const [
      charge,
      { invoiceAmount, receiptAmount, currencies: documentCurrencies },
      { transactionsAmount, currencies: transactionsCurrencies },
    ] = await Promise.all([
      safeGetChargeTempById(chargeId, injector),
      getChargeDocumentsAmounts(chargeId, injector),
      getChargeTransactionsAmounts(chargeId, injector),
    ]);
    if (charge.type === 'PAYROLL' && transactionsAmount != null) {
      return formatFinancialAmount(transactionsAmount, defaultLocalCurrency);
    }
    if ((invoiceAmount || receiptAmount) != null && documentCurrencies.length === 1) {
      return formatFinancialAmount(invoiceAmount || receiptAmount, documentCurrencies[0]);
    }
    if (transactionsAmount != null && transactionsCurrencies.length === 1) {
      return formatFinancialAmount(transactionsAmount, transactionsCurrencies[0]);
    }
    return null;
  },
  property: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).is_property,
  conversion: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).type === 'CONVERSION',
  salary: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).type === 'PAYROLL',
  isInvoicePaymentDifferentCurrency: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).invoice_payment_currency_diff,
  userDescription: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).user_description,
  minEventDate: async (chargeId, _, { injector }) => {
    const transactions = await injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);
    return getTransactionsMinEventDate(transactions);
  },
  minDebitDate: async (chargeId, _, { injector }) => {
    const transactions = await injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);
    return getTransactionsMinDebitDate(transactions);
  },
  minDocumentsDate: async (chargeId, _, { injector }) => {
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByChargeIdLoader.load(chargeId);
    return getDocumentsMinDate(documents);
  },
  validationData: (chargeId, _, context) => validateCharge(chargeId, context),
  metadata: chargeId => chargeId,
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
    (await safeGetChargeTempById(chargeId, injector)).optional_vat,
  optionalDocuments: async (chargeId, _, { injector }) =>
    (await safeGetChargeTempById(chargeId, injector)).documents_optional_flag,
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: documentRoot => documentRoot.charge_id,
};
