import { errorSimplifier } from '../../../shared/errors.js';
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
    try {
      const { documentsVatAmount, documentsCurrency } = await getChargeDocumentsMeta(
        dbCharge.id,
        injector,
      );
      return documentsVatAmount != null && documentsCurrency
        ? formatFinancialAmount(documentsVatAmount, documentsCurrency)
        : null;
    } catch (error) {
      throw errorSimplifier('Failed to fetch VAT amount', error);
    }
  },
  totalAmount: async (dbCharge, _, { adminContext: { defaultLocalCurrency }, injector }) =>
    calculateTotalAmount(dbCharge.id, injector, defaultLocalCurrency).catch(error => {
      throw errorSimplifier('Failed to fetch total amount', error);
    }),
  property: async (dbCharge, _, { injector }) => {
    try {
      const depreciation = await injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByChargeIdLoader.load(dbCharge.id);
      return depreciation.length > 0;
    } catch (error) {
      throw errorSimplifier('Failed to fetch depreciation records', error);
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
        throw errorSimplifier('Failed to fetch charge transactions meta', error);
      }),
  minDebitDate: async (DbCharge, _, { injector }) =>
    getChargeTransactionsMeta(DbCharge.id, injector)
      .then(({ transactionsMinDebitDate }) => transactionsMinDebitDate)
      .catch(error => {
        throw errorSimplifier('Failed to fetch min debit date', error);
      }),
  minDocumentsDate: async (DbCharge, _, { injector }) =>
    getChargeDocumentsMeta(DbCharge.id, injector)
      .then(docsMeta => docsMeta.documentsMinDate)
      .catch(error => {
        throw errorSimplifier('Failed to fetch min documents date', error);
      }),
  validationData: (DbCharge, _, context) =>
    validateCharge(DbCharge, context).catch(error => {
      throw errorSimplifier('Failed to fetch validation data', error);
    }),
  metadata: DbCharge => DbCharge,
  yearsOfRelevance: async (DbCharge, _, { injector }) => {
    try {
      const spreadRecords = await injector
        .get(ChargeSpreadProvider)
        .getChargeSpreadByChargeIdLoader.load(DbCharge.id);
      return (
        spreadRecords?.map(record => ({
          year: dateToTimelessDateString(record.year_of_relevance),
          amount: record.amount ? Number(record.amount) : null,
        })) ?? null
      );
    } catch (error) {
      throw errorSimplifier('Failed to fetch charge spread records', error);
    }
  },
  optionalVAT: DbCharge => DbCharge.optional_vat,
  optionalDocuments: DbCharge => DbCharge.documents_optional_flag,
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id) {
      return null;
    }
    try {
      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(documentRoot.charge_id);
      return charge ?? null;
    } catch (error) {
      throw errorSimplifier('Failed to fetch charge for document', error);
    }
  },
};
