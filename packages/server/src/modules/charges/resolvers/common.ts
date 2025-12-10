import { GraphQLError } from 'graphql';
import { dateToTimelessDateString, formatFinancialAmount } from '../../../shared/helpers/index.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';
import {
  calculateTotalAmount,
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../helpers/common.helper.js';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule } from '../types.js';

export const commonChargeFields: ChargesModule.ChargeResolvers = {
  id: DbCharge => DbCharge.id,
  vat: async (dbCharge, _, { injector }) => {
    const { documentsVatAmount, documentsCurrency } = await getChargeDocumentsMeta(
      dbCharge.id,
      injector,
    );
    return documentsVatAmount != null && documentsCurrency
      ? formatFinancialAmount(documentsVatAmount, documentsCurrency)
      : null;
  },
  totalAmount: async (dbCharge, _, { adminContext: { defaultLocalCurrency }, injector }) =>
    calculateTotalAmount(dbCharge.id, injector, defaultLocalCurrency),
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
  minEventDate: async (DbCharge, _, { injector }) =>
    getChargeTransactionsMeta(DbCharge.id, injector)
      .then(({ transactionsMinEventDate }) => transactionsMinEventDate)
      .catch(error => {
        console.error('Failed to fetch charge transactions meta:', error);
        throw new GraphQLError('Failed to fetch min event date');
      }),
  minDebitDate: async (DbCharge, _, { injector }) =>
    getChargeTransactionsMeta(DbCharge.id, injector)
      .then(({ transactionsMinDebitDate }) => transactionsMinDebitDate)
      .catch(error => {
        console.error('Failed to fetch charge transactions meta:', error);
        throw new GraphQLError('Failed to fetch min debit date');
      }),
  minDocumentsDate: async (DbCharge, _, { injector }) =>
    getChargeDocumentsMeta(DbCharge.id, injector).then(docsMeta => docsMeta.documentsMinDate),
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
