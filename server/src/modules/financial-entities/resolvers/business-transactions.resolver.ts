import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount, isTimelessDateString } from '@shared/helpers';
import type { RawBusinessTransactionsSum, TimelessDateString } from '@shared/types';
import { BusinessesTransactionsProvider } from '../providers/businesses-transactions.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type {
  FinancialEntitiesModule,
  IGetBusinessTransactionsSumFromLedgerRecordsParams,
} from '../types.js';

export const businessesResolvers: FinancialEntitiesModule.Resolvers &
  Pick<
    Resolvers,
    'BusinessTransactionsSumFromLedgerRecordsResult' | 'BusinessTransactionsFromLedgerRecordsResult'
  > = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }, { injector }) => {
      try {
        const res = await injector
          .get(BusinessesTransactionsProvider)
          .getBusinessTransactionsSumFromLedgerRecords(filters);

        const rawRes: Record<string, RawBusinessTransactionsSum> = {};

        for (const t of res) {
          if (!t.business_id) {
            throw new GraphQLError('business_id is null');
          }
          rawRes[t.business_id] ??= {
            ils: {
              credit: 0,
              debit: 0,
              total: 0,
            },
            eur: {
              credit: 0,
              debit: 0,
              total: 0,
            },
            gbp: {
              credit: 0,
              debit: 0,
              total: 0,
            },
            usd: {
              credit: 0,
              debit: 0,
              total: 0,
            },
            businessID: t.business_id,
          };

          const business = rawRes[t.business_id ?? ''];
          const currency =
            t.currency === 'אירו'
              ? 'eur'
              : t.currency === '$'
              ? 'usd'
              : t.currency === 'לש'
              ? 'gbp'
              : 'ils';
          const amount = Number.isNaN(t.amount) ? 0 : Number(t.amount);
          const foreignAmount = Number.isNaN(t.foreign_amount) ? 0 : Number(t.foreign_amount);
          const direction = (t.direction ?? 1) < 1 ? -1 : 1;

          business.ils.credit += direction > 0 ? amount : 0;
          business.ils.debit += direction < 0 ? amount : 0;
          business.ils.total += direction * amount;

          if (currency !== 'ils') {
            const foreignInfo = business[currency];

            foreignInfo.credit += direction > 0 ? foreignAmount : 0;
            foreignInfo.debit += direction < 0 ? foreignAmount : 0;
            foreignInfo.total += direction * foreignAmount;
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
    businessTransactionsFromLedgerRecords: async (_, { filters }, { injector }) => {
      try {
        const isFinancialEntityIds = filters?.financialEntityIds?.length ?? 0;
        const isBusinessIDs = filters?.businessIDs?.length ?? 0;
        const adjustedFilters: IGetBusinessTransactionsSumFromLedgerRecordsParams = {
          isBusinessIDs,
          businessIDs: isBusinessIDs > 0 ? (filters!.businessIDs as string[]) : [null],
          isFinancialEntityIds,
          financialEntityIds:
            isFinancialEntityIds > 0 ? (filters!.financialEntityIds as string[]) : [null],
          fromDate: isTimelessDateString(filters?.fromDate ?? '')
            ? (filters!.fromDate as TimelessDateString)
            : null,
          toDate: isTimelessDateString(filters?.toDate ?? '')
            ? (filters!.toDate as TimelessDateString)
            : null,
        };

        const res = await injector
          .get(BusinessesTransactionsProvider)
          .getBusinessTransactionsFromLedgerRecords(adjustedFilters);

        return {
          businessTransactions: res,
        };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error fetching business transactions from ledger records',
        };
      }
    },
    businessNamesFromLedgerRecords: async (_, __, { injector }) => {
      try {
        return injector
          .get(BusinessesTransactionsProvider)
          .getLedgerRecordsDistinctBusinesses()
          .then(res => res.filter(r => !!r.business_id).map(r => r.business_id));
      } catch (e) {
        console.error(e);
        return [];
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
    __isTypeOf: parent => !!parent,
    name: (parent, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
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
    business: rawSum => rawSum.businessID,
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
    __isTypeOf: parent => !!parent.business_id,
    amount: parent =>
      formatFinancialAmount(
        Number.isNaN(parent.foreign_amount)
          ? parent.amount
          : Number(parent.amount) * (parent.direction ?? 1),
        Currency.Ils,
      ),
    business: parent => parent.business_id!,
    eurAmount: parent =>
      parent.currency === 'אירו'
        ? formatFinancialAmount(
            Number.isNaN(parent.foreign_amount)
              ? parent.foreign_amount
              : Number(parent.foreign_amount) * (parent.direction ?? 1),
            Currency.Eur,
          )
        : null,
    gbpAmount: parent =>
      parent.currency === 'לש'
        ? formatFinancialAmount(
            Number.isNaN(parent.foreign_amount)
              ? parent.foreign_amount
              : Number(parent.foreign_amount) * (parent.direction ?? 1),
            Currency.Gbp,
          )
        : null,
    usdAmount: parent =>
      parent.currency === '$'
        ? formatFinancialAmount(
            Number.isNaN(parent.foreign_amount)
              ? parent.foreign_amount
              : Number(parent.foreign_amount) * (parent.direction ?? 1),
            Currency.Usd,
          )
        : null,

    invoiceDate: parent => format(parent.invoice_date!, 'yyyy-MM-dd') as TimelessDateString,
    reference1: parent => parent.reference_1 ?? null,
    reference2: parent => parent.reference_2 ?? null,
    details: parent => parent.details ?? null,
    counterAccount: parent => parent.counter_account_id ?? null,
  },
};
