import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { ledgerGenerationByCharge } from '@modules/ledger/helpers/ledger-generation-by-charge.helper.js';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type {
  BusinessTransactionProto,
  RawBusinessTransactionsSum,
  TimelessDateString,
} from '@shared/types';
import {
  getLedgerRecordsFromSets,
  handleBusinessLedgerRecord,
  handleBusinessTransaction,
} from '../helpers/business-transactions.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule, IGetFinancialEntitiesByIdsResult } from '../types.js';

export const businessTransactionsResolvers: FinancialEntitiesModule.Resolvers &
  Pick<
    Resolvers,
    'BusinessTransactionsSumFromLedgerRecordsResult' | 'BusinessTransactionsFromLedgerRecordsResult'
  > = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }, context, info) => {
      const injector = context.injector;
      const { ownerIds, businessIDs: financialEntitiesIDs, fromDate, toDate } = filters || {};

      const [businesses, taxCategories] = await Promise.all([
        injector
          .get(BusinessesProvider)
          .getFinancialEntityByIdLoader.loadMany(financialEntitiesIDs ?? []),
        injector.get(TaxCategoriesProvider).getAllTaxCategories(),
      ]);

      const businessIDs = businesses
        ?.filter(business => business && 'id' in business)
        .map(business => (business as IGetFinancialEntitiesByIdsResult).id);
      const taxCategoriesIDs = taxCategories
        .map(taxCategory => taxCategory.id)
        .filter(id => financialEntitiesIDs?.includes(id));

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge => ledgerGenerationByCharge(charge)(charge, {}, context, info)),
        );

        const ledgerRecords = await getLedgerRecordsFromSets(ledgerRecordSets, charges);

        const rawRes: Record<string, RawBusinessTransactionsSum> = {};

        for (const ledger of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && format(ledger.invoiceDate, 'yyyy-MM-dd') < fromDate) {
            continue;
          }
          if (!!toDate && format(ledger.invoiceDate, 'yyyy-MM-dd') > toDate) {
            continue;
          }

          if (
            ledger.creditAccountID1 &&
            (!financialEntitiesIDs?.length ||
              (typeof ledger.creditAccountID1 === 'string' &&
                businessIDs.includes(ledger.creditAccountID1)) ||
              (typeof ledger.creditAccountID1 === 'object' &&
                taxCategoriesIDs.includes(ledger.creditAccountID1.id)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.creditAccountID1,
              ledger.currency,
              true,
              ledger.localCurrencyCreditAmount1,
              ledger.creditAmount1,
            );
          }

          if (
            ledger.creditAccountID2 &&
            (!financialEntitiesIDs?.length ||
              (typeof ledger.creditAccountID2 === 'string' &&
                businessIDs.includes(ledger.creditAccountID2)) ||
              (typeof ledger.creditAccountID2 === 'object' &&
                taxCategoriesIDs.includes(ledger.creditAccountID2.id)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.creditAccountID2,
              ledger.currency,
              true,
              ledger.localCurrencyCreditAmount2,
              ledger.creditAmount2,
            );
          }

          if (
            ledger.debitAccountID1 &&
            (!financialEntitiesIDs?.length ||
              (typeof ledger.debitAccountID1 === 'string' &&
                businessIDs.includes(ledger.debitAccountID1)) ||
              (typeof ledger.debitAccountID1 === 'object' &&
                taxCategoriesIDs.includes(ledger.debitAccountID1.id)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.debitAccountID1,
              ledger.currency,
              false,
              ledger.localCurrencyDebitAmount1,
              ledger.debitAmount1,
            );
          }

          if (
            ledger.debitAccountID2 &&
            (!financialEntitiesIDs?.length ||
              (typeof ledger.debitAccountID2 === 'string' &&
                businessIDs.includes(ledger.debitAccountID2)) ||
              (typeof ledger.debitAccountID2 === 'object' &&
                taxCategoriesIDs.includes(ledger.debitAccountID2.id)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.debitAccountID2,
              ledger.currency,
              false,
              ledger.localCurrencyDebitAmount2,
              ledger.debitAmount2,
            );
          }
        }

        return {
          __typename: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult',
          businessTransactionsSum: Object.values(rawRes),
        };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error fetching business transactions summary from ledger records',
        };
      }
    },
    businessTransactionsFromLedgerRecords: async (_, { filters }, context, info) => {
      const injector = context.injector;
      const { ownerIds, businessIDs: financialEntitiesIDs, fromDate, toDate } = filters || {};

      const [businesses, taxCategories] = await Promise.all([
        injector
          .get(BusinessesProvider)
          .getFinancialEntityByIdLoader.loadMany(financialEntitiesIDs ?? []),
        injector.get(TaxCategoriesProvider).getAllTaxCategories(),
      ]);

      const businessIDs = businesses
        ?.filter(business => business && 'id' in business)
        .map(business => (business as IGetFinancialEntitiesByIdsResult).id);
      const taxCategoriesIDs = taxCategories
        .map(taxCategory => taxCategory.id)
        .filter(id => financialEntitiesIDs?.includes(id));

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge => ledgerGenerationByCharge(charge)(charge, {}, context, info)),
        );

        const ledgerRecords = await getLedgerRecordsFromSets(ledgerRecordSets, charges);

        const rawTransactions: BusinessTransactionProto[] = [];

        for (const record of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && format(record.invoiceDate, 'yyyy-MM-dd') < fromDate) {
            continue;
          }
          if (!!toDate && format(record.invoiceDate, 'yyyy-MM-dd') > toDate) {
            continue;
          }

          if (
            record.creditAccountID1 &&
            (!financialEntitiesIDs?.length ||
              (typeof record.creditAccountID1 === 'string' &&
                businessIDs.includes(record.creditAccountID1)) ||
              (typeof record.creditAccountID1 === 'object' &&
                taxCategoriesIDs.includes(record.creditAccountID1.id)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.creditAccountID1,
              record.debitAccountID1,
              true,
              record.localCurrencyCreditAmount1,
              record.creditAmount1,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.creditAccountID2 &&
            (!financialEntitiesIDs?.length ||
              (typeof record.creditAccountID2 === 'string' &&
                businessIDs.includes(record.creditAccountID2)) ||
              (typeof record.creditAccountID2 === 'object' &&
                taxCategoriesIDs.includes(record.creditAccountID2.id)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.creditAccountID2,
              record.debitAccountID2 ?? record.debitAccountID1,
              true,
              record.localCurrencyCreditAmount2,
              record.creditAmount2,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.debitAccountID1 &&
            (!financialEntitiesIDs?.length ||
              (typeof record.debitAccountID1 === 'string' &&
                businessIDs.includes(record.debitAccountID1)) ||
              (typeof record.debitAccountID1 === 'object' &&
                taxCategoriesIDs.includes(record.debitAccountID1.id)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.debitAccountID1,
              record.creditAccountID1,
              false,
              record.localCurrencyDebitAmount1,
              record.debitAmount1,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.debitAccountID2 &&
            (!financialEntitiesIDs?.length ||
              (typeof record.debitAccountID2 === 'string' &&
                businessIDs.includes(record.debitAccountID2)) ||
              (typeof record.debitAccountID2 === 'object' &&
                taxCategoriesIDs.includes(record.debitAccountID2.id)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.debitAccountID2,
              record.creditAccountID2 ?? record.creditAccountID1,
              false,
              record.localCurrencyDebitAmount2,
              record.debitAmount2,
            );
            rawTransactions.push(transaction);
          }
        }

        return {
          businessTransactions: rawTransactions.sort((a, b) => {
            const chargeA = charges.find(charge => charge.id === a.chargeId);
            const chargeB = charges.find(charge => charge.id === b.chargeId);
            const dateA = Math.min(
              ...([
                chargeA?.documents_min_date?.getTime(),
                chargeA?.transactions_min_event_date?.getTime(),
              ].filter(Boolean) as number[]),
            );
            const dateB = Math.min(
              ...([
                chargeB?.documents_min_date?.getTime(),
                chargeB?.transactions_min_event_date?.getTime(),
              ].filter(Boolean) as number[]),
            );

            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;

            if (a.chargeId < b.chargeId) return -1;
            if (a.chargeId > b.chargeId) return 1;

            if (a.date.getTime() < b.date.getTime()) return -1;
            if (a.date.getTime() > b.date.getTime()) return 1;

            return 0;
          }),
        };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error fetching business transactions from ledger records',
        };
      }
    },
  },
  BusinessTransactionsSumFromLedgerRecordsResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult';
    },
  },
  NamedCounterparty: {
    __isTypeOf: parent => typeof parent === 'string',
    name: (parent, _, { injector }) =>
      injector
        .get(BusinessesProvider)
        .getFinancialEntityByIdLoader.load(
          typeof parent === 'string'
            ? parent
            : (parent as unknown as { counterpartyID: string })!.counterpartyID,
        )
        .then(fe => {
          if (!fe) {
            throw new GraphQLError(`Financial entity not found for id ${parent}`);
          }
          return fe.name;
        }),
    id: parent =>
      typeof parent === 'string'
        ? parent
        : (parent as unknown as { counterpartyID: string })!.counterpartyID,
  },
  BusinessTransactionSum: {
    business: rawSum => rawSum.business,
    credit: rawSum => formatFinancialAmount(rawSum.ils.credit, Currency.Ils),
    debit: rawSum => formatFinancialAmount(rawSum.ils.debit, Currency.Ils),
    total: rawSum => formatFinancialAmount(rawSum.ils.total, Currency.Ils),
    eurSum: rawSum =>
      rawSum.eur.credit || rawSum.eur.debit
        ? {
            credit: formatFinancialAmount(rawSum.eur.credit, Currency.Eur),
            debit: formatFinancialAmount(rawSum.eur.debit, Currency.Eur),
            total: formatFinancialAmount(rawSum.eur.total, Currency.Eur),
          }
        : null,
    gbpSum: rawSum =>
      rawSum.gbp.credit || rawSum.gbp.debit
        ? {
            credit: formatFinancialAmount(rawSum.gbp.credit, Currency.Gbp),
            debit: formatFinancialAmount(rawSum.gbp.debit, Currency.Gbp),
            total: formatFinancialAmount(rawSum.gbp.total, Currency.Gbp),
          }
        : null,
    usdSum: rawSum =>
      rawSum.usd.credit | rawSum.usd.debit
        ? {
            credit: formatFinancialAmount(rawSum.usd.credit, Currency.Usd),
            debit: formatFinancialAmount(rawSum.usd.debit, Currency.Usd),
            total: formatFinancialAmount(rawSum.usd.total, Currency.Usd),
          }
        : null,
  },
  BusinessTransactionsFromLedgerRecordsResult: {
    __resolveType: parent =>
      'businessTransactions' in parent
        ? 'BusinessTransactionsFromLedgerRecordsSuccessfulResult'
        : 'CommonError',
  },
  BusinessTransaction: {
    __isTypeOf: parent => !!parent.businessID,
    amount: parent =>
      formatFinancialAmount(
        Number.isNaN(parent.foreignAmount)
          ? parent.amount
          : Number(parent.amount) * (parent.isCredit ? 1 : -1),
        Currency.Ils,
      ),
    business: parent => parent.businessID!,
    eurAmount: parent =>
      parent.currency === Currency.Eur
        ? formatFinancialAmount(
            Number.isNaN(parent.foreignAmount)
              ? parent.foreignAmount
              : Number(parent.foreignAmount) * (parent.isCredit ? 1 : -1),
            Currency.Eur,
          )
        : null,
    gbpAmount: parent =>
      parent.currency === Currency.Gbp
        ? formatFinancialAmount(
            Number.isNaN(parent.foreignAmount)
              ? parent.foreignAmount
              : Number(parent.foreignAmount) * (parent.isCredit ? 1 : -1),
            Currency.Gbp,
          )
        : null,
    usdAmount: parent =>
      parent.currency === Currency.Usd
        ? formatFinancialAmount(parent.foreignAmount * (parent.isCredit ? 1 : -1), Currency.Usd)
        : null,

    invoiceDate: parent => format(parent.date!, 'yyyy-MM-dd') as TimelessDateString,
    reference1: parent => parent.reference1 ?? null,
    reference2: _ => null,
    details: parent => parent.details ?? null,
    counterAccount: parent => parent.counterAccount ?? null,
  },
  TaxCategory: {
    __isTypeOf: parent => 'hashavshevet_name' in parent,
    id: parent => parent.id,
    name: parent => parent.name,
  },
};
