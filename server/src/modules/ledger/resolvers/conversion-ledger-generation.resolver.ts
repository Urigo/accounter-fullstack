import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY, FEE_CATEGORY_NAME } from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { CounterAccountProto, LedgerProto } from '@shared/types';
import { conversionFeeCalculator } from '../helpers/conversion-charge-ledger.helper.js';
import { getEntriesFromFeeTransaction, splitFeeTransactions } from '../helpers/fee-transactions.js';
import {
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  isTransactionsOppositeSign,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../helpers/utils.helper.js';

export const generateLedgerRecordsForConversion: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (charge, _, context) => {
  const chargeId = charge.id;
  const { injector } = context;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entity: CounterAccountProto }>();

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    let baseEntry: LedgerProto | undefined = undefined;
    let quoteEntry: LedgerProto | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    if (mainTransactions.length !== 2) {
      throw new GraphQLError(`Conversion Charge must include two main transactions`);
    }

    if (!isTransactionsOppositeSign(mainTransactions)) {
      throw new GraphQLError(
        `Conversion Charge must include two main transactions with opposite sign`,
      );
    }

    // for each transaction, create a ledger record
    const mainTransactionsPromises = mainTransactions.map(async transaction => {
      const { currency, valueDate } = validateTransactionBasicVariables(transaction);

      let amount = Number(transaction.amount);
      let foreignAmount: number | undefined = undefined;

      if (currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, valueDate);

        foreignAmount = amount;
        // calculate amounts in ILS
        amount = exchangeRate * amount;
      }

      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
      if (!account) {
        throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
      }
      const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, currency);
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(taxCategoryName);
      if (!taxCategory) {
        throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
      }

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: LedgerProto = {
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        ...(isCreditorCounterparty
          ? {
              debitAccountID1: taxCategory,
            }
          : {
              creditAccountID1: taxCategory,
            }),
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId,
      };

      if (amount < 0) {
        baseEntry = ledgerEntry;
      } else if (amount > 0) {
        quoteEntry = ledgerEntry;
      }

      mainFinancialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    await Promise.all(mainTransactionsPromises);

    if (!baseEntry || !quoteEntry) {
      throw new GraphQLError(`Conversion Charge must include two main transactions`);
    }

    // create a ledger record for fee transactions
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      await getEntriesFromFeeTransaction(transaction, charge, context).then(ledgerEntries => {
        feeFinancialAccountLedgerEntries.push(...ledgerEntries);
        ledgerEntries.map(ledgerEntry => {
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        });
      });
    });

    await Promise.all(feeTransactionsPromises);

    const miscLedgerEntries: LedgerProto[] = [];

    // calculate conversion fee
    const [quoteRate, baseRate] = await Promise.all(
      [(quoteEntry as LedgerProto).currency, (baseEntry as LedgerProto).currency].map(currency =>
        injector
          .get(ExchangeProvider)
          .getExchangeRates(
            currency as Currency,
            DEFAULT_LOCAL_CURRENCY,
            (baseEntry as LedgerProto).valueDate,
          ),
      ),
    );
    const toLocalRate = quoteRate;
    const directRate = quoteRate / baseRate;
    const conversionFee = conversionFeeCalculator(baseEntry, quoteEntry, directRate, toLocalRate);

    if (conversionFee.localAmount !== 0) {
      const feeTaxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(FEE_CATEGORY_NAME);
      if (!feeTaxCategory) {
        throw new GraphQLError(`Tax category "${FEE_CATEGORY_NAME}" not found`);
      }

      const isDebitConversion = conversionFee.localAmount >= 0;

      const ledgerEntry: LedgerProto = {
        id: (quoteEntry as LedgerProto).id + '|fee', // NOTE: this field is dummy
        creditAccountID1: isDebitConversion ? feeTaxCategory : undefined,
        creditAmount1: conversionFee.foreignAmount
          ? Math.abs(conversionFee.foreignAmount)
          : undefined,
        localCurrencyCreditAmount1: Math.abs(conversionFee.localAmount),
        debitAccountID1: isDebitConversion ? undefined : feeTaxCategory,
        debitAmount1: conversionFee.foreignAmount
          ? Math.abs(conversionFee.foreignAmount)
          : undefined,
        localCurrencyDebitAmount1: Math.abs(conversionFee.localAmount),
        description: 'Conversion fee',
        isCreditorCounterparty: true,
        invoiceDate: (quoteEntry as LedgerProto).invoiceDate,
        valueDate: (quoteEntry as LedgerProto).valueDate,
        currency: (quoteEntry as LedgerProto).currency,
        reference1: (quoteEntry as LedgerProto).reference1,
        ownerId: (quoteEntry as LedgerProto).ownerId,
        chargeId,
      };

      miscLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    const ledgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance);

    return {
      records: [
        ...mainFinancialAccountLedgerEntries,
        ...feeFinancialAccountLedgerEntries,
        ...miscLedgerEntries,
      ],
      balance: ledgerBalanceInfo,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
