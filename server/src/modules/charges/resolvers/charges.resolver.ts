import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { ExchangeProvider } from '@modules/ledger/providers/exchange.provider.js';
import { ChargeSortByField, Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type {
  ChargesModule,
  IGetChargesByFiltersResult,
  IUpdateChargeParams,
  IValidateChargesResult,
} from '../types.js';
import {
  commonDocumentsFields,
  commonFinancialAccountFields,
  commonFinancialEntityFields,
  commonTransactionFields,
} from './common.js';

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

      let charges: Array<IGetChargesByFiltersResult & { balance?: string | null }> = await injector
        .get(ChargesProvider)
        .getChargesByFilters({
          financialEntityIds: filters?.byOwners ?? undefined,
          businessesIDs: filters?.byBusinesses ?? undefined,
          fromDate: filters?.fromDate,
          toDate: filters?.toDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          chargeType: filters?.chargesType,
        })
        .catch(e => {
          throw new Error(e.message);
        });

      if (filters?.unbalanced) {
        const validationInfo = await injector
          .get(ChargesProvider)
          .validateCharges({ IDs: charges.map(c => c.id) });

        charges.map(c => {
          c.balance = validationInfo.find(v => v.id === c.id)?.balance;
        });
      }

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

      if (!filters?.unbalanced) {
        const validationInfo = await injector.get(ChargesProvider).validateCharges({
          IDs: pageCharges.map(c => c.id),
        });
        pageCharges.map(c => {
          c.balance = validationInfo.find(v => v.id === c.id)?.balance;
        });
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
      const financialAccountsToBalance = fields.beneficiaries
        ? JSON.stringify(
            fields.beneficiaries.map(b => ({
              id: b.counterparty.id,
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
        financialEntityID: fields.counterparty?.id,
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
    updateTransaction: async (_, { transactionId, fields }, { injector }) => {
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
        financialEntityID: null,
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
        injector.get(ChargesProvider).getChargeByIdLoader.clear(transactionId);
        const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
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
    transactions: DbCharge => [DbCharge],
    description: () => 'Missing', // TODO: implement
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
    property: DbCharge => DbCharge.is_property,
    currencyRatesAmount: async (DbCharge, _, { injector }) => {
      const ratesDate = DbCharge.debit_date || DbCharge.event_date;
      const debitExchangeRates = await injector.get(ExchangeProvider).getExchangeRates(ratesDate);
      const invoiceExchangeRates = await injector.get(ExchangeProvider).getExchangeRates(ratesDate);

      if (!debitExchangeRates ?? !invoiceExchangeRates) {
        return {
          id: DbCharge.id,
          usd: null,
          gbp: null,
          eur: null,
          date: new Date(),
        };
      }
      return {
        id: DbCharge.id,
        usd:
          formatFinancialAmount(debitExchangeRates.usd ?? invoiceExchangeRates.usd, Currency.Usd) ??
          null,
        gbp:
          formatFinancialAmount(debitExchangeRates.gbp ?? invoiceExchangeRates.gbp, Currency.Gbp) ??
          null,
        eur:
          formatFinancialAmount(debitExchangeRates.eur ?? invoiceExchangeRates.eur, Currency.Eur) ??
          null,
        date: debitExchangeRates.exchange_date ? invoiceExchangeRates.exchange_date : new Date(),
      };
    },
    validationData: async (DbCharge, _, { injector }) => {
      return validateCharge(
        DbCharge as IValidateChargesResult,
        injector.get(FinancialEntitiesProvider),
      );
    },
  },
  // UpdateChargeResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'Charge';
  //   },
  // },
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
