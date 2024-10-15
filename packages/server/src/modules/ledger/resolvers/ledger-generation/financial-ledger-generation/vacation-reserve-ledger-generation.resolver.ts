import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { calculateVacationReserveAmount } from '@modules/ledger/helpers/vacation-reserve.helper.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EMPTY_UUID,
  VACATION_RESERVE_EXPENSES_TAX_CATEGORY_ID,
  VACATION_RESERVE_TAX_CATEGORY_ID,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const generateLedgerRecordsForVacationReserveExpenses: ResolverFn<
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
        message: `Vacation reserves charge must include user description with designated year`,
      };
    }

    // look for revaluation year in the description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Vacation reserves charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return {
        __typename: 'CommonError',
        message: `Vacation reserves charge description must include valid year (2000 - current year)`,
      };
    }

    const { vacationReserveAmount } = await calculateVacationReserveAmount(injector, year);

    const ledgerEntry: LedgerProto = {
      id: EMPTY_UUID,
      invoiceDate: new Date(year, 11, 31),
      valueDate: new Date(year, 11, 31),
      currency: DEFAULT_LOCAL_CURRENCY,
      isCreditorCounterparty: true,
      creditAccountID1: VACATION_RESERVE_TAX_CATEGORY_ID,
      debitAccountID1: VACATION_RESERVE_EXPENSES_TAX_CATEGORY_ID,
      localCurrencyCreditAmount1: Math.abs(vacationReserveAmount),
      localCurrencyDebitAmount1: Math.abs(vacationReserveAmount),
      description: `Vacation reserve for ${year}`,
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
