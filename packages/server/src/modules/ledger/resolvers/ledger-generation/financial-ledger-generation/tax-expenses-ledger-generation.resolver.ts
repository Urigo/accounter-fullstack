import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import {
  decorateLedgerRecords,
  getProfitLossReportAmounts,
} from '@modules/reports/helpers/profit-and-loss.helper.js';
import { calculateTaxAmounts } from '@modules/reports/helpers/tax.helper.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EMPTY_UUID,
  TAX_BUSINESS_ID,
  TAX_EXPENSES_TAX_CATEGORY_ID,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const generateLedgerRecordsForTaxExpenses: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  try {
    const { injector } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge must include user description with designated year`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge description must include valid year (2000 - current year)`,
      };
    }

    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 0);
    const ledgerRecords = await injector
      .get(LedgerProvider)
      .getLedgerRecordsByDates({ fromDate: from, toDate: to });

    const financialEntitiesIds = new Set(
      ledgerRecords
        .map(record => [
          record.credit_entity1,
          record.credit_entity2,
          record.debit_entity1,
          record.debit_entity2,
        ])
        .flat()
        .filter(Boolean) as string[],
    );
    const financialEntities = (await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntitiesIds))
      .then(res =>
        res.filter(entity => {
          if (!entity) {
            return false;
          }
          if (entity instanceof Error) {
            throw entity;
          }
          return true;
        }),
      )) as IGetFinancialEntitiesByIdsResult[];

    const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

    const decoratedLedgerRecords = decorateLedgerRecords(ledgerRecords, financialEntitiesDict);

    const { researchAndDevelopmentExpensesAmount, profitBeforeTaxAmount } =
      getProfitLossReportAmounts(decoratedLedgerRecords);

    const { annualTaxExpenseAmount } = calculateTaxAmounts(
      researchAndDevelopmentExpensesAmount,
      profitBeforeTaxAmount,
    );

    const ledgerEntry: LedgerProto = {
      id: EMPTY_UUID,
      invoiceDate: new Date(year, 12, 31),
      valueDate: new Date(year, 12, 31),
      currency: DEFAULT_LOCAL_CURRENCY,
      isCreditorCounterparty: true,
      creditAccountID1: TAX_BUSINESS_ID,
      debitAccountID1: TAX_EXPENSES_TAX_CATEGORY_ID,
      localCurrencyCreditAmount1: Math.abs(annualTaxExpenseAmount),
      localCurrencyDebitAmount1: Math.abs(annualTaxExpenseAmount),
      description: `Tax expenses for ${year}`,
      ownerId: charge.owner_id,
      chargeId: charge.id,
      currencyRate: 1,
    };

    const ledgerEntries = [ledgerEntry];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, ledgerEntries, injector);
    }

    return {
      records: ledgerProtoToRecordsConverter(ledgerEntries),
      charge,
      balance: {
        isBalanced: true,
        unbalancedEntities: [],
        balanceSum: 0,
        financialEntities: [],
      },
      errors: [],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${charge.id}"\n${e}`,
    };
  }
};
