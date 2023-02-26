import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Currency } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatFinancialAmount, isTimelessDateString } from '@shared/helpers';
import type { RawBusinessTransactionsSum, TimelessDateString } from '@shared/types';
import { BusinessesTransactionsProvider } from '../providers/businesses-transactions.provider.js';
import type {
  FinancialEntitiesModule,
  IGetBusinessTransactionsSumFromLedgerRecordsParams,
} from '../types.js';

export const businessesResolvers: FinancialEntitiesModule.Resolvers &
  Pick<Resolvers, 'BusinessTransactionsSumFromLedgerRecordsResult'> = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }, { injector }) => {
      try {
        const res = await injector
          .get(BusinessesTransactionsProvider)
          .getBusinessTransactionsSumFromLedgerRecords(filters);

        const rawRes: Record<string, RawBusinessTransactionsSum> = {};

        res.forEach(t => {
          if (!t.business_name) {
            throw new GraphQLError('business_name is null');
          }
          rawRes[t.business_name] ??= {
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
            businessName: t.business_name,
          };

          const business = rawRes[t.business_name ?? ''];
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
        });

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
        const isBusinessNames = filters?.businessNames?.length ?? 0;
        const adjustedFilters: IGetBusinessTransactionsSumFromLedgerRecordsParams = {
          isBusinessNames,
          businessNames: isBusinessNames > 0 ? (filters!.businessNames as string[]) : [null],
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

        const businessTransactions: FinancialEntitiesModule.BusinessTransaction[] = res.map(t => {
          const direction = t.direction ?? 1;
          return {
            amount: formatFinancialAmount(
              Number.isNaN(t.foreign_amount) ? t.amount : Number(t.amount) * direction,
              Currency.Ils,
            ),
            businessName: t.business_name ?? 'Missing',
            eurAmount:
              t.currency === 'אירו'
                ? formatFinancialAmount(
                    Number.isNaN(t.foreign_amount)
                      ? t.foreign_amount
                      : Number(t.foreign_amount) * direction,
                    Currency.Eur,
                  )
                : undefined,
            gbpAmount:
              t.currency === 'לש'
                ? formatFinancialAmount(
                    Number.isNaN(t.foreign_amount)
                      ? t.foreign_amount
                      : Number(t.foreign_amount) * direction,
                    Currency.Gbp,
                  )
                : undefined,
            usdAmount:
              t.currency === '$'
                ? formatFinancialAmount(
                    Number.isNaN(t.foreign_amount)
                      ? t.foreign_amount
                      : Number(t.foreign_amount) * direction,
                    Currency.Usd,
                  )
                : undefined,

            invoiceDate: format(t.invoice_date!, 'yyyy-MM-dd') as TimelessDateString,
            reference1: t.reference_1 ?? null,
            reference2: t.reference_2 ?? null,
            details: t.details ?? null,
            counterAccount: t.counter_account ?? null,
          };
        });

        return {
          __typename: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult',
          businessTransactions,
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
          .then(res => res.map(r => r.business_name).filter(Boolean) as string[]);
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
    name: parent => parent ?? '',
  },
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
    __isTypeOf: () => true,
    counterparty: parent => parent.name,
    percentage: parent => parent.percentage,
  },
  BusinessTransactionSum: {
    businessName: rawSum => rawSum.businessName,
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
};
