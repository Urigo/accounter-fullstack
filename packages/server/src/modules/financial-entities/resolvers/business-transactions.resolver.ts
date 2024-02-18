import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type {
  BusinessTransactionProto,
  RawBusinessTransactionsSum,
  TimelessDateString,
} from '@shared/types';
import {
  handleBusinessLedgerRecord,
  handleBusinessTransaction,
} from '../helpers/business-transactions.helper.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  FinancialEntitiesModule,
  IGetBusinessesByIdsResult,
  IGetFinancialEntitiesByIdsResult,
} from '../types.js';

export const businessTransactionsResolvers: FinancialEntitiesModule.Resolvers &
  Pick<
    Resolvers,
    'BusinessTransactionsSumFromLedgerRecordsResult' | 'BusinessTransactionsFromLedgerRecordsResult'
  > = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }, context, _info) => {
      const injector = context.injector;
      const { ownerIds, businessIDs, fromDate, toDate } = filters || {};

      const [financialEntities, taxCategories] = await Promise.all([
        injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.loadMany(businessIDs ?? []),
        injector.get(TaxCategoriesProvider).getAllTaxCategories(),
      ]);

      const isFilteredByFinancialEntities = !!businessIDs?.length;

      const financialEntitiesIDs = financialEntities
        ?.filter(fe => fe && 'id' in fe)
        .map(fe => (fe as IGetFinancialEntitiesByIdsResult).id);
      const taxCategoriesIDs = taxCategories
        .map(taxCategory => taxCategory.id)
        .filter(id => filters?.businessIDs?.includes(id));

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge =>
            injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(charge.id),
          ),
        );

        const ledgerRecords = ledgerRecordSets.flat();

        const rawRes: Record<string, RawBusinessTransactionsSum> = {};

        for (const ledger of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && format(ledger.invoice_date, 'yyyy-MM-dd') < fromDate) {
            continue;
          }
          if (!!toDate && format(ledger.invoice_date, 'yyyy-MM-dd') > toDate) {
            continue;
          }

          if (
            ledger.credit_entity1 &&
            (!isFilteredByFinancialEntities ||
              (typeof ledger.credit_entity1 === 'string' &&
                financialEntitiesIDs.includes(ledger.credit_entity1)) ||
              (typeof ledger.credit_entity1 === 'object' &&
                taxCategoriesIDs.includes(ledger.credit_entity1)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.credit_entity1,
              ledger.currency as Currency,
              true,
              ledger.credit_local_amount1,
              ledger.credit_foreign_amount1,
            );
          }

          if (
            ledger.credit_entity2 &&
            (!isFilteredByFinancialEntities ||
              (typeof ledger.credit_entity2 === 'string' &&
                financialEntitiesIDs.includes(ledger.credit_entity2)) ||
              (typeof ledger.credit_entity2 === 'object' &&
                taxCategoriesIDs.includes(ledger.credit_entity2)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.credit_entity2,
              ledger.currency as Currency,
              true,
              ledger.credit_local_amount2,
              ledger.credit_foreign_amount2,
            );
          }

          if (
            ledger.debit_entity1 &&
            (!isFilteredByFinancialEntities ||
              (typeof ledger.debit_entity1 === 'string' &&
                financialEntitiesIDs.includes(ledger.debit_entity1)) ||
              (typeof ledger.debit_entity1 === 'object' &&
                taxCategoriesIDs.includes(ledger.debit_entity1)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.debit_entity1,
              ledger.currency as Currency,
              false,
              ledger.debit_local_amount1,
              ledger.debit_foreign_amount1,
            );
          }

          if (
            ledger.debit_entity2 &&
            (!isFilteredByFinancialEntities ||
              (typeof ledger.debit_entity2 === 'string' &&
                financialEntitiesIDs.includes(ledger.debit_entity2)) ||
              (typeof ledger.debit_entity2 === 'object' &&
                taxCategoriesIDs.includes(ledger.debit_entity2)))
          ) {
            handleBusinessLedgerRecord(
              rawRes,
              ledger.debit_entity2,
              ledger.currency as Currency,
              false,
              ledger.debit_local_amount2,
              ledger.debit_foreign_amount2,
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
    businessTransactionsFromLedgerRecords: async (_, { filters }, context, _info) => {
      const injector = context.injector;
      const { ownerIds, businessIDs, fromDate, toDate } = filters || {};

      const isFilteredByFinancialEntities = !!filters?.businessIDs?.length;

      const [financialEmtities, taxCategories] = await Promise.all([
        injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.loadMany(businessIDs ?? []),
        injector.get(TaxCategoriesProvider).getAllTaxCategories(),
      ]);

      // TODO: can be replaced with FinancialEntitiesProvider and type check?
      const financialEntitiesIDs = financialEmtities
        ?.filter(business => business && 'id' in business)
        .map(business => (business as IGetBusinessesByIdsResult).id);
      const taxCategoriesIDs = taxCategories
        .map(taxCategory => taxCategory.id)
        .filter(id => businessIDs?.includes(id));

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge =>
            injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(charge.id),
          ),
        );

        const ledgerRecords = ledgerRecordSets.flat();

        const rawTransactions: BusinessTransactionProto[] = [];

        for (const record of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && format(record.invoice_date, 'yyyy-MM-dd') < fromDate) {
            continue;
          }
          if (!!toDate && format(record.invoice_date, 'yyyy-MM-dd') > toDate) {
            continue;
          }

          if (
            record.credit_entity1 &&
            (!isFilteredByFinancialEntities ||
              (typeof record.credit_entity1 === 'string' &&
                financialEntitiesIDs.includes(record.credit_entity1)) ||
              (typeof record.credit_entity1 === 'object' &&
                taxCategoriesIDs.includes(record.credit_entity1)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.credit_entity1,
              record.debit_entity1,
              true,
              record.credit_local_amount1,
              record.credit_foreign_amount1,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.credit_entity2 &&
            (!isFilteredByFinancialEntities ||
              (typeof record.credit_entity2 === 'string' &&
                financialEntitiesIDs.includes(record.credit_entity2)) ||
              (typeof record.credit_entity2 === 'object' &&
                taxCategoriesIDs.includes(record.credit_entity2)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.credit_entity2,
              record.debit_entity2 ?? record.debit_entity2,
              true,
              record.credit_local_amount2,
              record.credit_foreign_amount2,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.debit_entity2 &&
            (!isFilteredByFinancialEntities ||
              (typeof record.debit_entity2 === 'string' &&
                financialEntitiesIDs.includes(record.debit_entity2)) ||
              (typeof record.debit_entity2 === 'object' &&
                taxCategoriesIDs.includes(record.debit_entity2)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.debit_entity2,
              record.credit_entity1,
              false,
              record.debit_local_amount1,
              record.debit_foreign_amount1,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.debit_entity2 &&
            (!isFilteredByFinancialEntities ||
              (typeof record.debit_entity2 === 'string' &&
                financialEntitiesIDs.includes(record.debit_entity2)) ||
              (typeof record.debit_entity2 === 'object' &&
                taxCategoriesIDs.includes(record.debit_entity2)))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.debit_entity2,
              record.credit_entity2 ?? record.credit_entity1,
              false,
              record.debit_local_amount2,
              record.debit_foreign_amount2,
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
  BusinessTransactionSum: {
    business: (rawSum, _, { injector }) =>
      typeof rawSum.business === 'string'
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(rawSum.business)
            .then(res => {
              if (!res) {
                throw new GraphQLError(`Business with id ${rawSum.business} not found`);
              }
              return res;
            })
        : rawSum.business,
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
    business: (parent, _, { injector }) =>
      typeof parent.businessID === 'string'
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(parent.businessID)
            .then(res => {
              if (!res) {
                throw new GraphQLError(`Financial entity with id ${parent.businessID} not found`);
              }
              return res;
            })
        : parent.businessID,
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
    counterAccount: (parent, _, { injector }) =>
      typeof parent.counterAccount === 'string'
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(parent.counterAccount)
            .then(res => {
              if (!res) {
                throw new GraphQLError(
                  `Financial entity with id ${parent.counterAccount} not found`,
                );
              }
              return res;
            })
        : parent.counterAccount ?? null,
  },
  TaxCategory: {
    __isTypeOf: parent => 'hashavshevet_name' in parent,
    id: parent => parent.id,
    name: parent => parent.name,
  },
};
