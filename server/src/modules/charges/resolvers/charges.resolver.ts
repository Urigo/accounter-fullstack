import { GraphQLError } from 'graphql';
import type { DocumentsTypes } from '@modules/documents/index.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { ChargeSortByField } from '@shared/enums';
import type { ChargeResolvers, Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IUpdateChargeParams, IValidateChargesResult } from '../types.js';
import {
  commonDocumentsFields,
  commonFinancialAccountFields,
  commonFinancialEntityFields,
} from './common.js';

const calculateVat: ChargeResolvers['vat'] = async (charge, _, { injector }) => {
  const documents = await injector
    .get(DocumentsProvider)
    .getDocumentsByChargeIdLoader.load(charge.id);
  const vatRecords = documents
    .filter(doc => ['INVOICE', 'INVOICE_RECEIPT'].includes(doc.type))
    .map(doc => ({ vat: doc.vat_amount, currency: doc.currency_code }));

  if (vatRecords.length === 0) {
    return null;
  }

  let currency: DocumentsTypes.currency | null = null;
  let vat = 0;
  for (const record of vatRecords) {
    if (record.currency) {
      currency ||= record.currency;
      if (record.currency !== currency) {
        throw new Error('Cannot calculate VAT for charge with multiple currencies');
      }
    }
    vat += record.vat ?? 0;
  }

  return formatFinancialAmount(vat, currency);
};

const calculateTotalAmount: ChargeResolvers['totalAmount'] = async (charge, _, { injector }) => {
  let currency: DocumentsTypes.currency | null = null;
  let amount = 0;

  // by default, calculate total amount from documents
  const documents = await injector
    .get(DocumentsProvider)
    .getDocumentsByChargeIdLoader.load(charge.id);

  // filter relevant documents
  const totalAmountRecords = documents
    .filter(doc => ['INVOICE', 'INVOICE_RECEIPT'].includes(doc.type))
    .map(doc => ({
      amount: doc.total_amount,
      currency: doc.currency_code,
      serial: doc.serial_number,
    }));

  // make sure we have at least one document
  if (totalAmountRecords.length > 0) {
    const invoiceNumbers = new Set<string>();
    for (const record of totalAmountRecords) {
      if (record.currency) {
        invoiceNumbers.add(record.serial ?? '');
        currency ||= record.currency;
        if (record.currency !== currency) {
          throw new Error('Cannot calculate total amount for charge with multiple currencies');
        }
      }
      if (!invoiceNumbers.has(record.serial ?? '')) {
        invoiceNumbers.add(record.serial ?? '');
        amount += record.amount ?? 0;
      }
    }

    return formatFinancialAmount(amount, currency);
  }

  // if no documents, calculate total amount from transactions
  const transactions = await injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(charge.id);

  if (transactions.length === 0) {
    return null;
  }

  for (const transaction of transactions) {
    if (transaction.currency) {
      currency ||= transaction.currency;
      if (transaction.currency !== currency) {
        throw new Error('Cannot calculate total amount for charge with multiple currencies');
      }
    }
    amount += Number(transaction.amount);
  }

  return formatFinancialAmount(amount, currency);
};

export const chargesResolvers: ChargesModule.Resolvers & Pick<Resolvers, 'UpdateChargeResult'> = {
  Query: {
    chargeById: async (_, { id }, { injector }) => {
      const dbCharge = await injector.get(ChargesProvider).getChargeByIdLoader.load(id);
      if (!dbCharge) {
        throw new Error(`Charge ID="${id}" not found`);
      }
      return dbCharge;
    },
    allCharges: async (_, { filters, page, limit }, { injector }) => {
      // handle sort column
      let sortColumn: 'event_date' | 'event_amount' | 'abs_event_amount' = 'event_date';
      switch (filters?.sortBy?.field) {
        case ChargeSortByField.Amount:
          sortColumn = 'event_amount';
          break;
        case ChargeSortByField.AbsAmount:
          sortColumn = 'abs_event_amount';
          break;
        case ChargeSortByField.Date:
          sortColumn = 'event_date';
          break;
      }

      let charges = await injector
        .get(ChargesProvider)
        .getChargesByFilters({
          financialEntityIds: filters?.byOwners ?? undefined,
          businessesIDs: filters?.byBusinesses ?? undefined,
          fromDate: filters?.fromDate,
          toDate: filters?.toDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          preCalculateBalance: filters?.unbalanced,
          preCountInvoices: filters?.withoutInvoice || filters?.withoutDocuments,
          preCountReceipts: filters?.withoutDocuments,
          preCountLedger: filters?.withoutLedger,
          chargeType: filters?.chargesType,
        })
        .catch(e => {
          throw new Error(e.message);
        });

      // apply post-query filters
      if (
        filters?.unbalanced ||
        filters?.withoutInvoice ||
        filters?.withoutDocuments ||
        filters?.withoutLedger
      ) {
        charges = charges.filter(
          c =>
            (!filters?.unbalanced || Number(c.balance) !== 0) &&
            (!filters?.withoutInvoice || Number(c.invoices_count) === 0) &&
            (!filters?.withoutDocuments ||
              Number(c.receipts_count) + Number(c.invoices_count) === 0) &&
            (!filters?.withoutLedger || Number(c.ledger_records_count) === 0),
        );
      }

      const pageCharges = charges.slice(page * limit - limit, page * limit);

      if (filters?.unbalanced) {
        const validationInfo = await injector.get(ChargesProvider).validateCharges({
          IDs: pageCharges.map(c => c.id),
        });
        pageCharges.map(c =>
          Object.assign(
            c,
            validationInfo.find(v => v.id === c.id),
          ),
        );
      }

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges,
        pageInfo: {
          totalPages: Math.ceil(charges.length / limit),
        },
      };
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }, { injector }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountantReviewed: fields.accountantApproval?.approved,
        counterpartyId: fields.counterpartyId,
        isConversion: fields.isConversion,
        isProperty: fields.isProperty,
        ownerId: fields.ownerId,
        userDescription: null, // TODO: should it be here or on transaction?
        chargeId,
      };
      try {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(chargeId);
        const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    mergeCharges: async (_, { baseChargeID, chargeIdsToMerge }, { injector }) => {
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(baseChargeID);
        if (!charge) {
          throw new Error(`Charge ID="${baseChargeID}" not found`);
        }

        for (const id of chargeIdsToMerge) {
          // update linked documents
          await injector.get(DocumentsProvider).replaceDocumentsChargeId({
            replaceChargeID: id,
            assertChargeID: baseChargeID,
          });

          // update linked transactions
          await injector.get(TransactionsProvider).replaceTransactionsChargeId({
            replaceChargeID: id,
            assertChargeID: baseChargeID,
          });

          // update linked ledger records
          await injector.get(LedgerProvider).replaceLedgerRecordsChargeId({
            replaceChargeID: id,
            assertChargeID: baseChargeID,
          });

          // delete charge
          await injector.get(ChargesProvider).deleteChargesByIds({ chargeIds: [id] });
        }

        return charge;
      } catch (e) {
        throw new GraphQLError(
          (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        );
      }
    },
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  Charge: {
    id: DbCharge => DbCharge.id,
    createdAt: () => new Date('1900-01-01'), // TODO: missing in DB
    description: () => 'Missing', // TODO: implement
    vat: calculateVat,
    withholdingTax: undefined, // deprecated for now
    totalAmount: calculateTotalAmount,
    property: DbCharge => DbCharge.is_property,
    validationData: (DbCharge, _, { injector }) => {
      if ('invoices_count' in DbCharge && DbCharge.invoices_count != null) {
        return validateCharge(DbCharge as IValidateChargesResult);
      }
      return injector.get(ChargesProvider).validateChargeByIdLoader.load(DbCharge.id);
    },
  },
  // UpdateChargeResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'Charge';
  //   },
  // },
  Invoice: {
    ...commonDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
  },
  BankFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  CardFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
