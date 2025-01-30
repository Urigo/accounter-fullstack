import { GraphQLError } from 'graphql';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { calculateDepreciationAmount } from '@modules/reports/helpers/tax.helper.js';
import { EMPTY_UUID } from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const generateLedgerRecordsForDepreciationExpenses: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  try {
    const {
      injector,
      adminContext: {
        defaultLocalCurrency,
        depreciation: {
          accumulatedDepreciationTaxCategoryId,
          rndDepreciationExpensesTaxCategoryId,
          gnmDepreciationExpensesTaxCategoryId,
          marketingDepreciationExpensesTaxCategoryId,
        },
      },
    } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Depreciation expenses charge must include user description with designated year`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Depreciation expenses charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return {
        __typename: 'CommonError',
        message: `Depreciation expenses charge description must include valid year (2000 - current year)`,
      };
    }

    const {
      rndDepreciationYearlyAmount,
      gnmDepreciationYearlyAmount,
      marketingDepreciationYearlyAmount,
      totalDepreciationYearlyAmount,
    } = await calculateDepreciationAmount(injector, year);
    const ledgerEntries: LedgerProto[] = [];

    // eslint-disable-next-line no-inner-declarations
    function addLedgerEntry(
      amount: number,
      description: string,
      creditor?: string,
      debtor?: string,
    ) {
      if (amount === 0) {
        return;
      }

      const ledgerEntry: LedgerProto = {
        id: EMPTY_UUID,
        invoiceDate: new Date(year, 11, 31),
        valueDate: new Date(year, 11, 31),
        currency: defaultLocalCurrency,
        isCreditorCounterparty: true,
        creditAccountID1: creditor,
        debitAccountID1: debtor,
        localCurrencyCreditAmount1: Math.abs(amount),
        localCurrencyDebitAmount1: Math.abs(amount),
        description: `${description} depreciation expenses for ${year}`,
        ownerId: charge.owner_id,
        chargeId: charge.id,
        currencyRate: 1,
      };

      ledgerEntries.push(ledgerEntry);
    }

    if (!accumulatedDepreciationTaxCategoryId) {
      throw new GraphQLError('Accumulated depreciation tax category is not defined');
    }
    if (!rndDepreciationExpensesTaxCategoryId) {
      throw new GraphQLError('R&D depreciation expenses tax category is not defined');
    }
    if (!gnmDepreciationExpensesTaxCategoryId) {
      throw new GraphQLError('G&M depreciation expenses tax category is not defined');
    }
    if (!marketingDepreciationExpensesTaxCategoryId) {
      throw new GraphQLError('Marketing depreciation expenses tax category is not defined');
    }

    addLedgerEntry(
      rndDepreciationYearlyAmount,
      'R&D',
      undefined,
      rndDepreciationExpensesTaxCategoryId,
    );
    addLedgerEntry(
      gnmDepreciationYearlyAmount,
      'G&M',
      undefined,
      gnmDepreciationExpensesTaxCategoryId,
    );
    addLedgerEntry(
      marketingDepreciationYearlyAmount,
      'Marketing',
      undefined,
      marketingDepreciationExpensesTaxCategoryId,
    );
    addLedgerEntry(
      totalDepreciationYearlyAmount,
      'Accumulated',
      accumulatedDepreciationTaxCategoryId,
    );

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, ledgerEntries, context);
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
