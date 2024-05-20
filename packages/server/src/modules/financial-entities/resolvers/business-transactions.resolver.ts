import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import type { BusinessTransactionProto, RawBusinessTransactionsSum } from '@shared/types';
import {
  handleBusinessLedgerRecord,
  handleBusinessTransaction,
} from '../helpers/business-transactions.helper.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
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
      const { ownerIds, businessIDs, fromDate, toDate, type } = filters || {};

      const shouldFetchAllFinancialEntities = !businessIDs?.length && !!type;
      const financialEntities = await (shouldFetchAllFinancialEntities
        ? injector.get(FinancialEntitiesProvider).getAllFinancialEntities()
        : injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.loadMany(businessIDs ?? []));

      const isFilteredByFinancialEntities = !!businessIDs?.length || type;

      const financialEntitiesIDs = financialEntities
        ?.filter(fe => {
          if (!fe || !('id' in fe)) {
            return false;
          }
          if (type) {
            return type.toLocaleLowerCase() === fe.type;
          }
          return true;
        })
        .map(fe => (fe as IGetFinancialEntitiesByIdsResult).id);

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          businessIds: businessIDs,
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
          if (!!fromDate && dateToTimelessDateString(ledger.invoice_date) < fromDate) {
            continue;
          }
          if (!!toDate && dateToTimelessDateString(ledger.invoice_date) > toDate) {
            continue;
          }

          if (
            ledger.credit_entity1 &&
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(ledger.credit_entity1))
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
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(ledger.credit_entity2))
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
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(ledger.debit_entity1))
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
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(ledger.debit_entity2))
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
      const { ownerIds, businessIDs, fromDate, toDate, type } = filters || {};

      const shouldFetchAllFinancialEntities = !businessIDs?.length && !!type;
      const financialEntities = await (shouldFetchAllFinancialEntities
        ? injector.get(FinancialEntitiesProvider).getAllFinancialEntities()
        : injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.loadMany(businessIDs ?? []));

      const isFilteredByFinancialEntities = !!filters?.businessIDs?.length;

      const financialEntitiesIDs = financialEntities
        ?.filter(fe => {
          if (!fe || !('id' in fe)) {
            return false;
          }
          if (type) {
            return type.toLocaleLowerCase() === fe.type;
          }
          return true;
        })
        .map(business => (business as IGetBusinessesByIdsResult).id);

      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          businessIds: businessIDs,
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
          if (!!fromDate && dateToTimelessDateString(record.invoice_date) < fromDate) {
            continue;
          }
          if (!!toDate && dateToTimelessDateString(record.invoice_date) > toDate) {
            continue;
          }

          if (
            record.credit_entity1 &&
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(record.credit_entity1))
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
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(record.credit_entity2))
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
            record.debit_entity1 &&
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(record.debit_entity1))
          ) {
            const transaction = handleBusinessTransaction(
              record,
              record.debit_entity1,
              record.credit_entity1,
              false,
              record.debit_local_amount1,
              record.debit_foreign_amount1,
            );
            rawTransactions.push(transaction);
          }

          if (
            record.debit_entity2 &&
            (!isFilteredByFinancialEntities || financialEntitiesIDs.includes(record.debit_entity2))
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
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(rawSum.businessId)
        .then(res => {
          if (!res) {
            throw new GraphQLError(`Business with id ${rawSum.businessId} not found`);
          }
          return res;
        }),
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
    __isTypeOf: parent => !!parent.businessId,
    amount: parent =>
      formatFinancialAmount(
        Number.isNaN(parent.foreignAmount)
          ? parent.amount
          : Number(parent.amount) * (parent.isCredit ? 1 : -1),
        Currency.Ils,
      ),
    business: (parent, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(parent.businessId)
        .then(res => {
          if (!res) {
            throw new GraphQLError(`Financial entity with id ${parent.businessId} not found`);
          }
          return res;
        }),
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

    invoiceDate: parent => dateToTimelessDateString(parent.date!),
    reference1: parent => parent.reference1 ?? null,
    reference2: _ => null,
    details: parent => parent.details ?? null,
    counterAccount: (parent, _, { injector }) =>
      parent.counterAccountId
        ? injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(parent.counterAccountId)
            .then(res => {
              if (!res) {
                throw new GraphQLError(
                  `Financial entity with id ${parent.counterAccountId} not found`,
                );
              }
              return res;
            })
        : null,
    chargeId: parent => parent.chargeId,
  },
  TaxCategory: {
    __isTypeOf: parent => 'hashavshevet_name' in parent,
    id: parent => parent.id,
    name: parent => parent.name,
  },
};
