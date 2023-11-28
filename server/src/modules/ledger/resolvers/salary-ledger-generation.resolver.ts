import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency, IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_CATEGORY_NAME,
  SALARY_BATCHED_BUSINESSES,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { generateEntriesFromSalaryRecords } from '../helpers/salary-charge-ledger.helper.js';
import {
  getTaxCategoryNameByAccountCurrency,
  validateTransactionBasicVariables,
} from '../helpers/utils.helper.js';

export const generateLedgerRecordsForSalary: ResolverFn<
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

    const accountingLedgerEntries: LedgerProto[] = [];

    // generate ledger from salary records
    const transactionDate =
      charge.transactions_min_debit_date ?? charge.transactions_min_event_date;
    if (transactionDate) {
      transactionDate.setDate(transactionDate.getDate() - 2); // adjusted date to match exchange rate of transaction initiation date

      const salaryRecords = await injector
        .get(SalariesProvider)
        .getSalaryRecordsByChargeIdLoader.load(charge.id);

      const { entries, balanceDelta } = generateEntriesFromSalaryRecords(
        salaryRecords,
        charge,
        transactionDate,
      );

      accountingLedgerEntries.push(...entries);
      ledgerBalance += balanceDelta;
      dates.add(transactionDate.getTime());
      currencies.add(DEFAULT_LOCAL_CURRENCY);
    }

    // generate ledger from transactions
    let transactions: Array<IGetTransactionsByChargeIdsResult> = [];
    const financialAccountLedgerEntries: LedgerProto[] = [];
    let hasBatchedCounterparty: boolean = false;

    // Get all transactions
    transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);

    // for each transaction, create a ledger record
    for (const transaction of transactions) {
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);
      let amount = Number(transaction.amount);
      let foreignAmount: number | undefined = undefined;

      if (SALARY_BATCHED_BUSINESSES.includes(transactionBusinessId)) {
        hasBatchedCounterparty = true;
      }

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

      financialAccountLedgerEntries.push({
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        creditAccountID1: isCreditorCounterparty ? undefined : taxCategory,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? taxCategory : undefined,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
      });

      ledgerBalance += amount;
      dates.add(valueDate.getTime());
      currencies.add(currency);
    }

    const miscLedgerEntries: LedgerProto[] = [];
    if (Math.abs(ledgerBalance) > 0.005) {
      const hasMultipleDates = dates.size > 1;
      const hasForeignCurrency = currencies.size > (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);
      if (hasMultipleDates && hasForeignCurrency) {
        const transactionEntry = financialAccountLedgerEntries[0];
        const salaryEntry = accountingLedgerEntries[0];

        const exchangeCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(EXCHANGE_RATE_CATEGORY_NAME);
        if (!exchangeCategory) {
          throw new GraphQLError(`Tax category "${EXCHANGE_RATE_CATEGORY_NAME}" not found`);
        }

        const amount = Math.abs(ledgerBalance);

        const isCreditorCounterparty = ledgerBalance < 0;

        miscLedgerEntries.push({
          id: transactionEntry.id,
          creditAccountID1: isCreditorCounterparty ? undefined : exchangeCategory,
          creditAmount1: undefined,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? exchangeCategory : undefined,
          debitAmount1: undefined,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: salaryEntry.invoiceDate,
          valueDate: transactionEntry.valueDate,
          currency: transactionEntry.currency, // NOTE: this field is dummy
          ownerId: transactionEntry.ownerId,
        });
      } else {
        throw new GraphQLError(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${hasForeignCurrency ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    // handle salary batched charges
    if (hasBatchedCounterparty) {
      // TODO: implement
      console.log('hasBatchedCounterparty');
    }

    return {
      records: [...accountingLedgerEntries, ...financialAccountLedgerEntries, ...miscLedgerEntries],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
