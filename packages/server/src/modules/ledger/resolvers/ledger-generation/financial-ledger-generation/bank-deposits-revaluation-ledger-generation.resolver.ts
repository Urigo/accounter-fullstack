import { sub } from 'date-fns';
import { GraphQLError } from 'graphql';
import type {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../../__generated__/types.js';
import { ExchangeProvider } from '../../../../../modules/exchange-rates/providers/exchange.provider.js';
import { businessTransactionsSumFromLedgerRecords } from '../../../../../modules/financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.js';
import { storeInitialGeneratedRecords } from '../../../../../modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../../../../modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { EMPTY_UUID } from '../../../../../shared/constants.js';
import { Currency } from '../../../../../shared/enums.js';
import { dateToTimelessDateString, formatCurrency } from '../../../../../shared/helpers/index.js';
import type {
  CurrencySum,
  LedgerProto,
  TimelessDateString,
} from '../../../../../shared/types/index.js';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const BANK_DEPOSITS_REVALUATION_LEDGER_DESCRIPTION = 'Bank deposits revaluation of currency';

export const generateLedgerRecordsForBankDepositsRevaluation: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context, info) => {
  try {
    const {
      injector,
      adminContext: {
        defaultLocalCurrency,
        general: {
          taxCategories: { exchangeRevaluationTaxCategoryId },
        },
        bankDeposits: { bankDepositBusinessId },
      },
    } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge must include user description with designated year`,
      };
    }
    if (!bankDepositBusinessId) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits business is not set`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge description must include valid year (2000 - current year)`,
      };
    }

    const revaluationDate = `${year}-12-31` as TimelessDateString;

    const cumulativeDate = dateToTimelessDateString(sub(new Date(revaluationDate), { days: 1 }));
    const bankDepositsCumulativeBalance = await businessTransactionsSumFromLedgerRecords(
      {},
      {
        filters: {
          ownerIds: [charge.owner_id],
          businessIDs: [bankDepositBusinessId],
          toDate: cumulativeDate,
          includeRevaluation: false,
        },
      },
      context,
      info,
    );

    if (
      !('businessTransactionsSum' in bankDepositsCumulativeBalance) ||
      bankDepositsCumulativeBalance.businessTransactionsSum.length === 0
    ) {
      throw new GraphQLError('Failed to get accounts transaction-based balance');
    }

    const bankDepositsBalance = await bankDepositsCumulativeBalance.businessTransactionsSum[0];

    const currencies: Currency[] = Object.entries(bankDepositsBalance)
      .filter(
        ([key, value]) =>
          Object.values(Currency).includes(key as Currency) &&
          ((value as CurrencySum).total !== 0 ||
            (value as CurrencySum).debit !== 0 ||
            (value as CurrencySum).credit !== 0),
      )
      .map(([key]) => key as Currency);

    const exchangeRates = new Map<Currency, number>();
    await Promise.all(
      currencies.map(currency =>
        injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultLocalCurrency, new Date(revaluationDate))
          .then(rates => exchangeRates.set(currency, rates)),
      ),
    );

    const errors: Set<string> = new Set();
    const ledgerEntries: LedgerProto[] = [];

    const currenciesLedgerPromise = Object.entries(bankDepositsBalance).map(
      async ([currency, sum]) => {
        if (!currencies.includes(currency as Currency) || currency === defaultLocalCurrency) {
          return;
        }

        const rate = exchangeRates.get(formatCurrency(currency as Currency));
        if (!rate) {
          errors.add(`No exchange rate found for date ${revaluationDate}, currency "${currency}"`);
          return;
        }

        const cumulativeLocalBalance = bankDepositsBalance[defaultLocalCurrency].total;
        const cumulativeForeignBalance = (sum as CurrencySum).total;

        const revaluationDiff = cumulativeLocalBalance - cumulativeForeignBalance * rate;

        if (Math.abs(revaluationDiff) < 0.005) {
          return;
        }

        const isCreditorCounterparty = revaluationDiff < 0;

        const ledgerEntry: LedgerProto = {
          id: EMPTY_UUID,
          invoiceDate: new Date(revaluationDate),
          valueDate: new Date(revaluationDate),
          currency: defaultLocalCurrency,
          isCreditorCounterparty,
          ...(isCreditorCounterparty
            ? {
                creditAccountID1: bankDepositBusinessId,
                debitAccountID1: exchangeRevaluationTaxCategoryId,
              }
            : {
                creditAccountID1: exchangeRevaluationTaxCategoryId,
                debitAccountID1: bankDepositBusinessId,
              }),
          localCurrencyCreditAmount1: Math.abs(revaluationDiff),
          localCurrencyDebitAmount1: Math.abs(revaluationDiff),
          description: `${BANK_DEPOSITS_REVALUATION_LEDGER_DESCRIPTION} "${currency}"`,
          ownerId: charge.owner_id,
          chargeId: charge.id,
          currencyRate: rate,
        };

        ledgerEntries.push(ledgerEntry);
      },
    );

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        ledgerEntries.push(entry);
      });
    });

    await Promise.all([expensesLedgerPromise, ...currenciesLedgerPromise]);

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, ledgerEntries, context);
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
