import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { generateLedgerRecords } from '@modules/ledger/resolvers/ledger-generation.resolver.js';
import { Currency } from '@shared/enums';
import type { Resolvers, ResolverTypeWrapper } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type {
  BusinessTransactionProto,
  CounterAccountProto,
  LedgerProto,
  RawBusinessTransactionsSum,
  TimelessDateString,
} from '@shared/types';
import { BusinessesTransactionsProvider } from '../providers/businesses-transactions.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

function handleBusinessLedgerRecord(
  rawRes: Record<string, RawBusinessTransactionsSum>,
  business: CounterAccountProto,
  currency: Currency,
  isCredit: boolean,
  amount = 0,
  foreignAmount = 0,
) {
  const businessID = typeof business === 'string' ? business : business.id;
  rawRes[businessID] ??= {
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
    business,
  };

  const record = rawRes[businessID];
  let currencyField: 'eur' | 'usd' | 'gbp' | 'ils' | undefined = undefined;
  switch (currency) {
    case Currency.Ils: {
      currencyField = 'ils';

      break;
    }
    case Currency.Eur: {
      currencyField = 'eur';
      break;
    }
    case Currency.Gbp: {
      currencyField = 'gbp';
      break;
    }
    case Currency.Usd: {
      currencyField = 'usd';
      break;
    }
    default: {
      console.log(`currency ${currency} not supported`);
      return;
    }
  }

  record.ils.credit += isCredit ? amount : 0;
  record.ils.debit += isCredit ? 0 : amount;
  record.ils.total += (isCredit ? 1 : -1) * amount;

  if (currencyField !== 'ils') {
    const foreignInfo = record[currencyField];

    foreignInfo.credit += isCredit ? foreignAmount : 0;
    foreignInfo.debit += isCredit ? 0 : foreignAmount;
    foreignInfo.total += (isCredit ? 1 : -1) * foreignAmount;
  }
}

function handleBusinessTransaction(
  record: LedgerProto,
  businessID: string,
  counterparty: CounterAccountProto,
  isCredit: boolean,
  amount = 0,
  foreignAmount = 0,
): BusinessTransactionProto {
  const rawTransaction: BusinessTransactionProto = {
    amount,
    businessID,
    counterAccount: counterparty,
    currency: record.currency,
    details: record.description,
    isCredit,
    ownerID: record.ownerId,
    foreignAmount,
    date: record.invoiceDate,
    reference1: record.reference1,
  };
  return rawTransaction;
}

export const businessesResolvers: FinancialEntitiesModule.Resolvers &
  Pick<
    Resolvers,
    'BusinessTransactionsSumFromLedgerRecordsResult' | 'BusinessTransactionsFromLedgerRecordsResult'
  > = {
  Query: {
    businessTransactionsSumFromLedgerRecords: async (_, { filters }, { injector }, info) => {
      const { ownerIds, businessIDs, fromDate, toDate } = filters || {};
      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
          businessIds: businessIDs ?? undefined,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge => generateLedgerRecords(charge, {}, { injector }, info)),
        );
        const ledgerRecordsPromises: ResolverTypeWrapper<LedgerProto>[] = [];
        ledgerRecordSets.map((ledgerRecordSet, i) => {
          if (!ledgerRecordSet) {
            console.log(`No ledger records could be generated for charge ${charges[i]?.id}`);
          } else if (
            ('__typename' in ledgerRecordSet || 'message' in ledgerRecordSet) &&
            ledgerRecordSet.__typename === 'CommonError'
          ) {
            console.log(
              `Error generating ledger records for charge ${charges[i]?.id}: ${ledgerRecordSet.message}`,
            );
          } else {
            ledgerRecordsPromises.push(
              ...(ledgerRecordSet as { records: readonly ResolverTypeWrapper<LedgerProto>[] })
                .records,
            );
          }
        });
        const ledgerRecords = await Promise.all(ledgerRecordsPromises);

        const rawRes: Record<string, RawBusinessTransactionsSum> = {};

        for (const ledger of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && ledger.invoiceDate.getTime() < new Date(fromDate).getTime()) {
            continue;
          }
          if (!!toDate && ledger.invoiceDate.getTime() > new Date(toDate).getTime()) {
            continue;
          }

          if (
            !!ledger.creditAccountID1 &&
            (!businessIDs || businessIDs.includes(ledger.creditAccountID1))
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
            !!ledger.creditAccountID2 &&
            (!businessIDs || businessIDs.includes(ledger.creditAccountID2))
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
            !!ledger.debitAccountID1 &&
            (!businessIDs || businessIDs.includes(ledger.debitAccountID1))
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
            !!ledger.debitAccountID2 &&
            (!businessIDs || businessIDs.includes(ledger.debitAccountID2))
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
    businessTransactionsFromLedgerRecords: async (_, { filters }, { injector }, info) => {
      const { ownerIds, businessIDs, fromDate, toDate } = filters || {};
      try {
        const charges = await injector.get(ChargesProvider).getChargesByFilters({
          ownerIds: ownerIds ?? undefined,
          fromAnyDate: fromDate,
          toAnyDate: toDate,
          businessIds: businessIDs ?? undefined,
        });
        const ledgerRecordSets = await Promise.all(
          charges.map(charge => generateLedgerRecords(charge, {}, { injector }, info)),
        );
        const ledgerRecordsPromises: ResolverTypeWrapper<LedgerProto>[] = [];
        ledgerRecordSets.map((ledgerRecordSet, i) => {
          if (!ledgerRecordSet) {
            console.log(`No ledger records could be generated for charge ${charges[i]?.id}`);
          } else if (
            ('__typename' in ledgerRecordSet || 'message' in ledgerRecordSet) &&
            ledgerRecordSet.__typename === 'CommonError'
          ) {
            console.log(
              `Error generating ledger records for charge ${charges[i]?.id}: ${ledgerRecordSet.message}`,
            );
          } else {
            ledgerRecordsPromises.push(
              ...(ledgerRecordSet as { records: readonly ResolverTypeWrapper<LedgerProto>[] })
                .records,
            );
          }
        });
        const ledgerRecords = await Promise.all(ledgerRecordsPromises);

        const rawTransactions: BusinessTransactionProto[] = [];

        for (const record of ledgerRecords) {
          // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
          if (!!fromDate && record.invoiceDate.getTime() < new Date(fromDate).getTime()) {
            continue;
          }
          if (!!toDate && record.invoiceDate.getTime() > new Date(toDate).getTime()) {
            continue;
          }

          if (
            typeof record.creditAccountID1 === 'string' &&
            (!businessIDs || businessIDs.includes(record.creditAccountID1))
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
            typeof record.creditAccountID2 === 'string' &&
            (!businessIDs || businessIDs.includes(record.creditAccountID2))
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
            typeof record.debitAccountID1 === 'string' &&
            (!businessIDs || businessIDs.includes(record.debitAccountID1))
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
            typeof record.debitAccountID2 === 'string' &&
            (!businessIDs || businessIDs.includes(record.debitAccountID2))
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
          businessTransactions: rawTransactions,
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
    __isTypeOf: parent => typeof parent === 'string',
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
    counterAccount: parent => parent.counterAccount,
  },
  TaxCategory: {
    __isTypeOf: parent => 'hashavshevet_name' in parent,
    id: parent => parent.id,
    name: parent => parent.name,
  },
};
