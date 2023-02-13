import type {
  IGetChargesByFiltersResult,
  IUpdateChargeParams,
  IValidateChargesResult,
} from '../../__generated__/charges.types.mjs';
import { ChargeSortByField, Currency, Resolvers } from '../../__generated__/types.mjs';
import { formatFinancialAmount } from '../../helpers/amount.mjs';
import { validateCharge } from '../../helpers/charges.mjs';
import {
  getChargeByIdLoader,
  getChargesByFilters,
  updateCharge,
  validateChargeByIdLoader,
  validateCharges,
} from '../../providers/charges.mjs';
import { pool } from '../../providers/db.mjs';
import { getDocumentsByChargeIdLoader } from '../../providers/documents.mjs';
import { getFinancialAccountsByFinancialEntityIdLoader } from '../../providers/financial-accounts.mjs';
import {
  getFinancialEntityByChargeIdsLoader,
  getFinancialEntityByIdLoader,
} from '../../providers/financial-entities.mjs';
import { getLedgerRecordsByChargeIdLoader } from '../../providers/ledger-records.mjs';
import { commonTransactionFields } from './common.mjs';

export const chargesResolvers: Resolvers = {
  Query: {
    chargeById: async (_, { id }) => {
      const dbCharge = await getChargeByIdLoader.load(id);
      if (!dbCharge) {
        throw new Error(`Charge ID="${id}" not found`);
      }
      return dbCharge;
    },
    allCharges: async (_, { filters, page, limit }) => {
      // handle sort column
      let sortColumn: keyof IGetChargesByFiltersResult = 'event_date';
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

      const businesses: Array<string | null> = [];
      if (filters?.byBusinesses?.length) {
        const businessNames = await Promise.all(
          filters.byBusinesses.map(id => getFinancialEntityByIdLoader.load(id)),
        );
        businesses.push(...(businessNames.map(b => b?.name).filter(Boolean) as string[]));
      }

      let charges = await getChargesByFilters
        .run(
          {
            financialEntityIds: filters?.byOwners ?? undefined,
            businesses,
            fromDate: filters?.fromDate,
            toDate: filters?.toDate,
            sortColumn,
            asc: filters?.sortBy?.asc !== false,
            preCalculateBalance: filters?.unbalanced,
            preCountInvoices: filters?.withoutInvoice || filters?.withoutDocuments,
            preCountReceipts: filters?.withoutDocuments,
            preCountLedger: filters?.withoutLedger,
          },
          pool,
        )
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
        const validationInfo = await validateCharges.run(
          {
            IDs: pageCharges.map(c => c.id),
          },
          pool,
        );
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
    updateCharge: async (_, { chargeId, fields }) => {
      const financialAccountsToBalance = fields.beneficiaries
        ? JSON.stringify(
            fields.beneficiaries.map(b => ({
              name: b.counterparty.name,
              percentage: b.percentage,
            })),
          )
        : null;
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: null,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: fields.totalAmount?.currency ?? null,
        currencyRate: null,
        currentBalance: null,
        debitDate: null,
        detailedBankDescription: null,
        eventAmount: fields.totalAmount?.raw?.toFixed(2) ?? null,
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance,
        financialEntity: fields.counterparty?.name,
        hashavshevetId: null,
        interest: null,
        isConversion: null,
        isProperty: fields.isProperty,
        links: null,
        originalId: null,
        personalCategory: fields.tags?.[0]?.name ?? null,
        proformaInvoiceFile: null,
        receiptDate: null,
        receiptImage: null,
        receiptNumber: null,
        receiptUrl: null,
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: null,
        vat: fields.vat ?? null,
        withholdingTax: fields.withholdingTax ?? null,
        chargeId,
      };
      try {
        getChargeByIdLoader.clear(chargeId);
        const res = await updateCharge.run({ ...adjustedFields }, pool);
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
    updateTransaction: async (_, { transactionId, fields }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: fields.referenceNumber,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: null,
        currencyRate: null,
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        currentBalance:
          fields.balance?.currency && fields.balance.currency !== Currency.Ils
            ? null
            : fields.balance?.raw?.toFixed(2),
        debitDate: fields.effectiveDate ? new Date(fields.effectiveDate) : null,
        detailedBankDescription: null,
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        eventAmount:
          fields.amount?.currency && fields.amount.currency !== Currency.Ils
            ? null
            : fields.amount?.raw?.toFixed(2),
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance: null,
        financialEntity: null,
        hashavshevetId: fields.hashavshevetId,
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
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: fields.userNote,
        vat: null,
        withholdingTax: null,
        chargeId: transactionId,
      };
      try {
        getChargeByIdLoader.clear(transactionId);
        const res = await updateCharge.run({ ...adjustedFields }, pool);
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
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
  },
  Charge: {
    id: DbCharge => DbCharge.id,
    createdAt: () => new Date('1900-01-01'), // TODO: missing in DB
    additionalDocuments: async DbCharge => {
      if (!DbCharge.id) {
        return [];
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      return docs;
    },
    ledgerRecords: async DbCharge => {
      if (!DbCharge.id) {
        return [];
      }
      const records = await getLedgerRecordsByChargeIdLoader.load(DbCharge.id);
      return records;
    },
    transactions: DbCharge => [DbCharge],
    counterparty: DbCharge => DbCharge.financial_entity,
    description: () => 'Missing', // TODO: implement
    tags: DbCharge => (DbCharge.personal_category ? [{ name: DbCharge.personal_category }] : []),
    beneficiaries: async DbCharge => {
      // TODO: update to better implementation after DB is updated
      try {
        if (DbCharge.financial_accounts_to_balance) {
          return JSON.parse(DbCharge.financial_accounts_to_balance);
        }
      } catch {
        null;
      }
      switch (DbCharge.financial_accounts_to_balance) {
        case 'no':
          return [
            {
              name: 'Uri',
              percentage: 50,
            },
            {
              name: 'Dotan',
              percentage: 50,
            },
          ];
        case 'uri':
          return [
            {
              name: 'Uri',
              percentage: 100,
            },
          ];
        case 'dotan':
          return [
            {
              name: 'dotan',
              percentage: 100,
            },
          ];
        default:
          {
            // case Guild account
            const guildAccounts = await getFinancialAccountsByFinancialEntityIdLoader.load(
              '6a20aa69-57ff-446e-8d6a-1e96d095e988',
            );
            const guildAccountsNumbers = guildAccounts.map(a => a.account_number);
            if (guildAccountsNumbers.includes(DbCharge.account_number)) {
              return [
                {
                  name: 'Uri',
                  percentage: 50,
                },
                {
                  name: 'Dotan',
                  percentage: 50,
                },
              ];
            }

            // case UriLTD account
            const uriAccounts = await getFinancialAccountsByFinancialEntityIdLoader.load(
              'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
            );
            const uriAccountsNumbers = uriAccounts.map(a => a.account_number);
            if (uriAccountsNumbers.includes(DbCharge.account_number)) {
              return [
                {
                  name: 'Uri',
                  percentage: 100,
                },
              ];
            }
          }
          return [];
      }
    },
    vat: DbCharge =>
      DbCharge.vat == null ? null : formatFinancialAmount(DbCharge.vat, DbCharge.currency_code),
    withholdingTax: DbCharge =>
      DbCharge.withholding_tax == null
        ? null
        : formatFinancialAmount(DbCharge.withholding_tax, DbCharge.currency_code),
    totalAmount: DbCharge =>
      DbCharge.event_amount == null
        ? null
        : formatFinancialAmount(DbCharge.event_amount, DbCharge.currency_code),
    invoice: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      const invoices = docs.filter(d => ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (invoices.length > 1) {
        console.log(
          `Charge ${DbCharge.id} has more than one invoices: [${invoices
            .map(r => `"${r.id}"`)
            .join(', ')}]`,
        );
      }
      return invoices.shift() ?? null;
    },
    receipt: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      const receipts = docs.filter(d => ['RECEIPT', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (receipts.length > 1) {
        console.log(
          `Charge ${DbCharge.id} has more than one receipt: [${receipts
            .map(r => `"${r.id}"`)
            .join(', ')}]`,
        );
      }
      return receipts.shift() ?? null;
    },
    accountantApproval: DbCharge => ({
      approved: DbCharge.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    property: DbCharge => DbCharge.is_property,
    financialEntity: DbCharge =>
      getFinancialEntityByChargeIdsLoader.load(DbCharge.id).then(res => {
        if (!res) {
          throw new Error(`Unable to find financial entity for charge ${DbCharge.id}`);
        }
        return res;
      }),
    validationData: DbCharge => {
      if ('balance' in DbCharge) {
        return validateCharge(DbCharge as IValidateChargesResult);
      }
      return validateChargeByIdLoader.load(DbCharge.id);
    },
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  // ConversionTransaction: {
  //   // __isTypeOf: (DbTransaction) => DbTransaction.is_conversion ?? false,
  //   ...commonTransactionFields,
  // },
  CommonTransaction: {
    __isTypeOf: () => true,
    ...commonTransactionFields,
  },
};
