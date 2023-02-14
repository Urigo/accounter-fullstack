import { IGetBusinessTransactionsSumFromLedgerRecordsParams } from '../../../__generated__/business-transactions-from-ledger.types.mjs';
import { BusinessTransaction, Currency, Resolvers } from '../../../__generated__/types.mjs';
import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { isTimelessDateString } from '../../../helpers/misc.mjs';
import { RawBusinessTransactionsSum, TimelessDateString } from '../../../models/index.mjs';
import {
  getBusinessTransactionsFromLedgerRecords,
  getBusinessTransactionsSumFromLedgerRecords,
  getLedgerRecordsDistinctBusinesses,
} from '../../../providers/business-transactions-from-ledger.mjs';
import { pool } from '../../../providers/db.mjs';
import { getAccountCardsByKeysLoader } from '../../../providers/hash-account-cards.mjs';
import { getSortCodesByIdLoader } from '../../../providers/hash-sort-codes.mjs';
import { format } from 'date-fns';
import { GraphQLError } from 'graphql';

export const businessesResolvers: Resolvers = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }) => {
      try {
        const res = await getBusinessTransactionsSumFromLedgerRecords.run(filters, pool);

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

        return { businessTransactionsSum: Object.values(rawRes) };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error fetching business transactions summary from ledger records',
        };
      }
    },
    businessTransactionsFromLedgerRecords: async (_, { filters }) => {
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

        const res = await getBusinessTransactionsFromLedgerRecords.run(adjustedFilters, pool);

        const businessTransactions: BusinessTransaction[] = res.map(t => {
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
    businessNamesFromLedgerRecords: async () => {
      try {
        return getLedgerRecordsDistinctBusinesses
          .run(undefined, pool)
          .then(res => res.map(r => r.business_name).filter(Boolean) as string[]);
      } catch (e) {
        console.error(e);
        return [];
      }
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
  BusinessTransactionsSumFromLedgerRecordsResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult';
    },
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
    sortCode: rawSum =>
      getAccountCardsByKeysLoader.load(rawSum.businessName).then(async card => {
        if (!card) {
          throw new GraphQLError(
            `Hashavshevet account card not found for business "${rawSum.businessName}"`,
          );
        }
        return await getSortCodesByIdLoader.load(card.sort_code).then(sortCode => {
          if (!sortCode) {
            throw new GraphQLError(
              `Hashavshevet sort code not found for account card "${card.key}"`,
            );
          }
          return sortCode;
        });
      }),
  },
};
