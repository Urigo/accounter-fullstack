import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import type { IGetAllTaxCategoriesResult } from '@modules/financial-entities/types';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  DIVIDEND_TAX_CATEGORY_ID,
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
  DIVIDEND_WITHHOLDING_TAX_PERCENTAGE,
  UUID_REGEX,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { splitDividendTransactions } from '../helpers/dividend-ledger.helper.js';
import {
  generatePartialLedgerEntry,
  getTaxCategoryNameByAccountCurrency,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../helpers/utils.helper.js';

export const generateLedgerRecordsForDividend: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, number>();

    // generate ledger from transactions
    const paymentsFinancialAccountLedgerEntries: LedgerProto[] = [];
    const withholdingTaxFinancialAccountLedgerEntries: LedgerProto[] = [];
    let mainAccount: IGetAllTaxCategoriesResult | undefined = undefined;
    let dividendTaxCategory: IGetAllTaxCategoriesResult | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { withholdingTaxTransactions, paymentsTransactions } =
      splitDividendTransactions(transactions);

    // create a ledger record for tax deduction origin
    for (const preValidatedTransaction of withholdingTaxTransactions) {
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

      let exchangeRate: number | undefined = undefined;
      if (transaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(
            transaction.currency,
            DEFAULT_LOCAL_CURRENCY,
            transaction.debit_timestamp,
          );
      }

      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
      if (!account) {
        throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
      }
      const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, transaction.currency);
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(taxCategoryName);
      if (!taxCategory) {
        throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
      }

      const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

      // set main account for dividend
      mainAccount ||= taxCategory;
      if (mainAccount.id !== taxCategory.id) {
        throw new GraphQLError(`Tax category is not consistent`);
      }

      const ledgerEntry: LedgerProto = {
        ...partialEntry,
        creditAccountID1: partialEntry.isCreditorCounterparty
          ? transaction.business_id
          : taxCategory,
        debitAccountID1: partialEntry.isCreditorCounterparty
          ? taxCategory
          : transaction.business_id,
      };

      withholdingTaxFinancialAccountLedgerEntries.push(ledgerEntry);

      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    // create a ledger record for dividend payments
    for (const preValidatedTransaction of paymentsTransactions) {
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

      let exchangeRate: number | undefined = undefined;
      if (transaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(
            transaction.currency,
            DEFAULT_LOCAL_CURRENCY,
            transaction.debit_timestamp,
          );
      }

      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
      if (!account) {
        throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
      }
      const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, transaction.currency);
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(taxCategoryName);
      if (!taxCategory) {
        throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
      }

      const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

      if (partialEntry.currency !== DEFAULT_LOCAL_CURRENCY) {
        // TODO: implement
        throw new GraphQLError(`Payment currency is not local`);
      }

      const withholdingTaxAmount =
        ((partialEntry.isCreditorCounterparty
          ? partialEntry.localCurrencyDebitAmount1
          : partialEntry.localCurrencyCreditAmount1) *
          DIVIDEND_WITHHOLDING_TAX_PERCENTAGE) /
        (1 - DIVIDEND_WITHHOLDING_TAX_PERCENTAGE);

      const ledgerEntry: LedgerProto = {
        ...partialEntry,
        ...(partialEntry.isCreditorCounterparty
          ? {
              creditAccountID1: transaction.business_id,
              localCurrencyCreditAmount1:
                partialEntry.localCurrencyCreditAmount1 + withholdingTaxAmount,
              debitAccountID1: taxCategory,
              debitAccountID2: DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
              localCurrencyDebitAmount2: withholdingTaxAmount,
            }
          : {
              creditAccountID1: taxCategory,
              creditAccountID2: DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
              localCurrencyCreditAmount2: withholdingTaxAmount,
              debitAccountID1: transaction.business_id,
              localCurrencyDebitAmount1:
                partialEntry.localCurrencyDebitAmount1 + withholdingTaxAmount,
            }),
      };

      paymentsFinancialAccountLedgerEntries.push(ledgerEntry);

      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);

      // close the payed business against dividend tax category
      dividendTaxCategory ||= await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByIDsLoader.load(DIVIDEND_TAX_CATEGORY_ID);
      if (!dividendTaxCategory) {
        throw new GraphQLError(`Dividend tax category couldn't be found`);
      }

      const localAmount = ledgerEntry.isCreditorCounterparty
        ? ledgerEntry.localCurrencyCreditAmount1
        : ledgerEntry.localCurrencyDebitAmount1;
      const closingEntry: LedgerProto = {
        ...ledgerEntry,
        localCurrencyCreditAmount1: localAmount,
        localCurrencyDebitAmount1: localAmount,
        ...(partialEntry.isCreditorCounterparty
          ? {
              creditAccountID1: dividendTaxCategory,
              debitAccountID1: transaction.business_id,
            }
          : {
              creditAccountID1: transaction.business_id,
              debitAccountID1: dividendTaxCategory,
            }),
        creditAccountID2: undefined,
        debitAccountID2: undefined,
      };

      paymentsFinancialAccountLedgerEntries.push(closingEntry);

      updateLedgerBalanceByEntry(closingEntry, ledgerBalance);
    }

    // validate ledger balance
    let ledgerBalanceSum = 0;
    for (const [side, balance] of ledgerBalance.entries()) {
      if (balance === 0) {
        continue;
      }
      if (UUID_REGEX.test(side)) {
        throw new GraphQLError(`Business ID="${side}" is not balanced`);
      }
      ledgerBalanceSum += balance;
    }
    if (ledgerBalanceSum !== 0) {
      throw new GraphQLError(`Ledger is not balanced`);
    }

    return {
      records: [
        ...withholdingTaxFinancialAccountLedgerEntries,
        ...paymentsFinancialAccountLedgerEntries,
        //  ...miscLedgerEntries
      ],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
