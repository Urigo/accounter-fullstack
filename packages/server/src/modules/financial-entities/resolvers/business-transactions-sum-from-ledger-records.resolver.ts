import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { REVALUATION_LEDGER_DESCRIPTION } from '@modules/ledger/resolvers/ledger-generation/financial-ledger-generation/revaluation-ledger-generation.resolver.js';
import {
  Currency,
  QueryBusinessTransactionsSumFromLedgerRecordsArgs,
  ResolverFn,
  ResolversTypes,
} from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { RawBusinessTransactionsSum } from '@shared/types';
import { handleBusinessLedgerRecord } from '../helpers/business-transactions.helper.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { IGetFinancialEntitiesByIdsResult } from '../types.js';

export const businessTransactionsSumFromLedgerRecords: ResolverFn<
  ResolversTypes['BusinessTransactionsSumFromLedgerRecordsResult'],
  object,
  GraphQLModules.Context,
  Partial<QueryBusinessTransactionsSumFromLedgerRecordsArgs>
> = async (_, { filters }, context, _info) => {
  const injector = context.injector;
  const {
    ownerIds,
    businessIDs,
    fromDate,
    toDate,
    type,
    includeRevaluation = true,
  } = filters || {};
  const isFilteredByFinancialEntities = !!businessIDs?.length || type;

  try {
    const financialEntitiesIDsPromise = async () => {
      try {
        const shouldFetchAllFinancialEntities = !businessIDs?.length && !!type;
        const financialEntities = await (shouldFetchAllFinancialEntities
          ? injector.get(FinancialEntitiesProvider).getAllFinancialEntities()
          : injector
              .get(FinancialEntitiesProvider)
              .getFinancialEntityByIdLoader.loadMany(businessIDs ?? []));

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

        return financialEntitiesIDs;
      } catch (e) {
        console.error(e);
        throw new Error('Error fetching financial entities');
      }
    };

    const ledgerRecordsPromise = async () => {
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

        return ledgerRecords;
      } catch (e) {
        console.error(e);
        throw new Error('Error fetching ledger records');
      }
    };

    const [financialEntitiesIDs, ledgerRecords] = await Promise.all([
      financialEntitiesIDsPromise(),
      ledgerRecordsPromise(),
    ]);

    const rawRes: Record<string, RawBusinessTransactionsSum> = {};

    for (const ledger of ledgerRecords) {
      // re-filter ledger records by date (to prevent charge's out-of-range dates from affecting the sum)
      if (!!fromDate && dateToTimelessDateString(ledger.invoice_date) < fromDate) {
        continue;
      }
      if (!!toDate && dateToTimelessDateString(ledger.invoice_date) > toDate) {
        continue;
      }

      // if shouldn't include revaluation ledger, skip records of toDate filter (/today)
      if (
        !includeRevaluation &&
        ledger.description?.includes(REVALUATION_LEDGER_DESCRIPTION) &&
        (toDate || dateToTimelessDateString(new Date())) ===
          dateToTimelessDateString(ledger.invoice_date)
      ) {
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
};
