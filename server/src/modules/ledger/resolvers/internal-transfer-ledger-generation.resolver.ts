import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_CATEGORY_NAME,
  FEE_CATEGORY_NAME,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { isSupplementalFeeTransaction, splitFeeTransactions } from '../helpers/fee-transactions.js';
import {
  getTaxCategoryNameByAccountCurrency,
  isTransactionsOppositeSign,
  validateTransactionBasicVariables,
} from '../helpers/utils.helper.js';

export const generateLedgerRecordsForInternalTransfer: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  try {
    // validate ledger records are balanced
    let ledgerBalance = 0;

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    let originEntry: LedgerProto | undefined = undefined;
    let destinationEntry: LedgerProto | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    if (mainTransactions.length !== 2) {
      throw new GraphQLError(`Internal transfer Charge must include two main transactions`);
    }

    if (!isTransactionsOppositeSign(mainTransactions[0], mainTransactions[1])) {
      throw new GraphQLError(
        `Internal transfer Charge must include two main transactions with opposite sign`,
      );
    }

    // create a ledger record for main transactions
    for (const transaction of mainTransactions) {
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
              debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyDebitAmount1: Math.abs(amount),
            }
          : {
              creditAccountID1: taxCategory,
              creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyCreditAmount1: Math.abs(amount),
            }),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
      };

      if (amount < 0) {
        originEntry = ledgerEntry;
      } else if (amount > 0) {
        destinationEntry = ledgerEntry;
      }

      mainFinancialAccountLedgerEntries.push(ledgerEntry);

      ledgerBalance += amount;
      dates.add(valueDate.getTime());
      currencies.add(currency);
    }

    if (!originEntry || !destinationEntry) {
      throw new GraphQLError(`Internal transfer Charge must include two main transactions`);
    }

    // create a ledger record for fee transactions
    for (const transaction of feeTransactions) {
      if (!transaction.is_fee) {
        continue;
      }

      const isSupplementalFee = isSupplementalFeeTransaction(transaction);
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);

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

      const feeTaxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(FEE_CATEGORY_NAME);
      if (!feeTaxCategory) {
        throw new GraphQLError(`Tax category "${FEE_CATEGORY_NAME}" not found`);
      }

      const isCreditorCounterparty = amount > 0;

      if (isSupplementalFee) {
        const account = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
        if (!account) {
          throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
        }
        const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, currency);
        const businessTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(taxCategoryName);
        if (!businessTaxCategory) {
          throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
        }

        feeFinancialAccountLedgerEntries.push({
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty ? feeTaxCategory : businessTaxCategory,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? businessTaxCategory : feeTaxCategory,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        });
      } else {
        const businessTaxCategory = destinationEntry.debitAccountID1!;
        if (!businessTaxCategory) {
          throw new GraphQLError(`Tax category "${EXCHANGE_RATE_CATEGORY_NAME}" not found`);
        }

        feeFinancialAccountLedgerEntries.push({
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty ? feeTaxCategory : transactionBusinessId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? transactionBusinessId : feeTaxCategory,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty: !isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        });

        ledgerBalance -= amount;
        dates.add(valueDate.getTime());
        currencies.add(currency);
      }
    }

    const miscLedgerEntries: LedgerProto[] = [];
    // Add ledger completion entries
    if (Math.abs(ledgerBalance) > 0.005) {
      const hasMultipleDates = dates.size > 1;
      const hasForeignCurrency = currencies.size > (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);
      if (hasMultipleDates && hasForeignCurrency) {
        const exchangeCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(EXCHANGE_RATE_CATEGORY_NAME);
        if (!exchangeCategory) {
          throw new GraphQLError(`Tax category "${EXCHANGE_RATE_CATEGORY_NAME}" not found`);
        }

        const amount = Math.abs(ledgerBalance);

        const isCreditorCounterparty = ledgerBalance > 0;

        miscLedgerEntries.push({
          id: destinationEntry.id, // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? exchangeCategory : undefined,
          creditAmount1: undefined,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? undefined : exchangeCategory,
          debitAmount1: undefined,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: originEntry.invoiceDate,
          valueDate: destinationEntry.valueDate,
          currency: destinationEntry.currency, // NOTE: this field is dummy
          ownerId: destinationEntry.ownerId,
        });
      } else {
        throw new GraphQLError(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${hasForeignCurrency ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    return {
      records: [
        ...mainFinancialAccountLedgerEntries,
        ...feeFinancialAccountLedgerEntries,
        ...miscLedgerEntries,
      ],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
