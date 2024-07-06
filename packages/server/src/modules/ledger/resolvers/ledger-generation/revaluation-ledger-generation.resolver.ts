import { sub } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { businessTransactionsSumFromLedgerRecords } from '@modules/financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EMPTY_UUID,
  EXCHANGE_REVALUATION_TAX_CATEGORY_ID,
} from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { dateToTimelessDateString, formatCurrency } from '@shared/helpers';
import type { LedgerProto, TimelessDateString } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../helpers/utils.helper.js';

export const REVALUATION_LEDGER_DESCRIPTION = 'Revaluation of account';

export const generateLedgerRecordsForRevaluation: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context, info) => {
  try {
    const { injector } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Revaluation charge must include user description with designated date`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Revaluation charge description must include designated date in yyyy-mm-dd format`,
      };
    }

    const revaluationDate = matches[0] as TimelessDateString;

    const foreignAccountsPromise = injector
      .get(TaxCategoriesProvider)
      .taxCategoryByFinancialAccountOwnerIdsLoader.load(charge.owner_id);

    const [accountTaxCategories] = await Promise.all([foreignAccountsPromise]);

    if (accountTaxCategories.length === 0) {
      throw new Error('No accounts found');
    }

    const foreignAccounts = accountTaxCategories.filter(
      ({ currency }) => currency !== DEFAULT_LOCAL_CURRENCY,
    );

    if (foreignAccounts.length === 0) {
      throw new Error('No foreign accounts found');
    }

    const currencies = new Set<Currency>(
      foreignAccounts.map(({ currency }) => currency as Currency),
    );

    const cumulativeDate = dateToTimelessDateString(sub(new Date(revaluationDate), { days: 1 }));
    const accountsCumulativeBalancePromise = businessTransactionsSumFromLedgerRecords(
      {},
      {
        filters: {
          ownerIds: [charge.owner_id],
          businessIDs: foreignAccounts.map(account => account.id),
          toDate: cumulativeDate,
          includeRevaluation: false,
        },
      },
      context,
      info,
    );
    const exchangeRates = new Map<Currency, number>();
    const [accountsCumulativeBalanceData] = await Promise.all([
      accountsCumulativeBalancePromise,
      ...Array.from(currencies).map(async currency => {
        const rates = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, new Date(revaluationDate));
        exchangeRates.set(currency, rates);
      }),
    ]);

    if (!accountsCumulativeBalanceData || 'message' in accountsCumulativeBalanceData) {
      throw new GraphQLError('Failed to get accounts transaction-based balance');
    }

    const accountsCumulativeBalance = await Promise.all(
      accountsCumulativeBalanceData.businessTransactionsSum,
    );

    const errors: Set<string> = new Set();
    const ledgerEntries: LedgerProto[] = [];

    foreignAccounts.map(async account => {
      const rate = exchangeRates.get(formatCurrency(account.currency));
      if (!rate) {
        errors.add(
          `No exchange rate found for date ${revaluationDate}, currency "${account.currency}"`,
        );
        return;
      }
      const cumulativeSums = accountsCumulativeBalance.find(
        balance => balance.businessId === account.id,
      );
      if (!cumulativeSums || cumulativeSums[account.currency].total === 0) {
        return;
      }
      const cumulativeLocalBalance = cumulativeSums[DEFAULT_LOCAL_CURRENCY].total;
      const cumulativeForeignBalance = cumulativeSums[account.currency].total;

      const revaluationDiff = cumulativeLocalBalance - cumulativeForeignBalance * rate;

      if (revaluationDiff === 0) {
        return;
      }

      const isCreditorCounterparty = revaluationDiff < 0;

      const ledgerEntry: LedgerProto = {
        id: EMPTY_UUID,
        invoiceDate: new Date(revaluationDate),
        valueDate: new Date(revaluationDate),
        currency: DEFAULT_LOCAL_CURRENCY,
        isCreditorCounterparty,
        ...(isCreditorCounterparty
          ? {
              creditAccountID1: account.id,
              debitAccountID1: EXCHANGE_REVALUATION_TAX_CATEGORY_ID,
            }
          : {
              creditAccountID1: EXCHANGE_REVALUATION_TAX_CATEGORY_ID,
              debitAccountID1: account.id,
            }),
        localCurrencyCreditAmount1: Math.abs(revaluationDiff),
        localCurrencyDebitAmount1: Math.abs(revaluationDiff),
        description: `${REVALUATION_LEDGER_DESCRIPTION} "${account.name}"`,
        ownerId: charge.owner_id,
        chargeId: charge.id,
        currencyRate: rate,
      };

      ledgerEntries.push(ledgerEntry);
    });

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
      errors: Array.from(errors),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${charge.id}"\n${e}`,
    };
  }
};
