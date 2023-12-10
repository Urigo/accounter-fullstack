import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID,
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_CATEGORY_NAME,
  PENSION_EXPENSES_TAX_CATEGORY_ID,
  SALARY_BATCHED_BUSINESSES,
  SALARY_EXPENSES_TAX_CATEGORY_ID,
  SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID,
  TAX_DEDUCTIONS_BUSINESS_ID,
  TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID,
  ZKUFOT_EXPENSES_TAX_CATEGORY_ID,
  ZKUFOT_INCOME_TAX_CATEGORY_ID,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { CounterAccountProto, LedgerProto, StrictLedgerProto } from '@shared/types';
import { generateEntriesFromSalaryRecords } from '../helpers/salary-charge-ledger.helper.js';
import {
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  updateLedgerBalanceByEntry,
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
    const ledgerBalance = new Map<string, { amount: number; entity: CounterAccountProto }>();

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    const accountingLedgerEntries: LedgerProto[] = [];

    // generate ledger from salary records
    const transactionDate =
      charge.transactions_min_debit_date ?? charge.transactions_min_event_date;
    if (!transactionDate) {
      throw new GraphQLError(`Charge ID="${charge.id}" is missing transaction date`);
    }

    // Get relevant data for generation
    const salaryRecordsPromise = injector
      .get(SalariesProvider)
      .getSalaryRecordsByChargeIdLoader.load(charge.id);
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const [salaryRecords, transactions] = await Promise.all([
      salaryRecordsPromise,
      transactionsPromise,
    ]);

    // generate ledger from salary records
    const {
      entries,
      salaryExpensesAmount,
      socialSecurityExpensesAmount,
      pensionFundExpensesAmount,
      compensationProvidentFundExpensesAmount,
      trainingFundExpensesAmount,
      zkufotAmount,
      month,
    } = generateEntriesFromSalaryRecords(salaryRecords, charge, transactionDate);

    for (const ledgerEntry of entries) {
      accountingLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(ledgerEntry.valueDate.getTime());
    }
    currencies.add(DEFAULT_LOCAL_CURRENCY);

    // generate monthly ledger entries
    const monthlyEntriesSet: { taxCategoryId: string; amount: number; isCredit: boolean }[] = [
      {
        taxCategoryId: ZKUFOT_EXPENSES_TAX_CATEGORY_ID,
        amount: zkufotAmount,
        isCredit: false,
      },
      {
        taxCategoryId: ZKUFOT_INCOME_TAX_CATEGORY_ID,
        amount: zkufotAmount,
        isCredit: true,
      },
      {
        taxCategoryId: SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID,
        amount: socialSecurityExpensesAmount,
        isCredit: false,
      },
      {
        taxCategoryId: SALARY_EXPENSES_TAX_CATEGORY_ID,
        amount: salaryExpensesAmount,
        isCredit: false,
      },
      {
        taxCategoryId: TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID,
        amount: trainingFundExpensesAmount,
        isCredit: false,
      },
      {
        taxCategoryId: PENSION_EXPENSES_TAX_CATEGORY_ID,
        amount: pensionFundExpensesAmount,
        isCredit: false,
      },
      {
        taxCategoryId: COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID,
        amount: compensationProvidentFundExpensesAmount,
        isCredit: false,
      },
    ];
    const montylyEntries = await Promise.all(
      monthlyEntriesSet
        .filter(({ amount }) => amount !== 0)
        .map(async ({ taxCategoryId, amount, isCredit }) => {
          const taxCategory = await injector
            .get(TaxCategoriesProvider)
            .taxCategoryByIDsLoader.load(taxCategoryId);
          if (!taxCategory) {
            throw new GraphQLError(`Tax category "${taxCategoryId}" not found`);
          }

          const ledgerEntry: LedgerProto = {
            id: taxCategory.id,
            invoiceDate: transactionDate,
            valueDate: transactionDate,
            currency: DEFAULT_LOCAL_CURRENCY,
            ...(isCredit ? { creditAccountID1: taxCategory } : { debitAccountID1: taxCategory }),
            localCurrencyCreditAmount1: amount,
            localCurrencyDebitAmount1: amount,
            description: `${month} salary: ${taxCategory.name}`,
            isCreditorCounterparty: false, // TODO: check
            ownerId: charge.owner_id,
          };

          return ledgerEntry;
        }),
    );

    for (const ledgerEntry of montylyEntries) {
      accountingLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(ledgerEntry.valueDate.getTime());
    }

    // generate ledger from transactions
    const financialAccountLedgerEntries: LedgerProto[] = [];
    let hasBatchedCounterparty: boolean = false;

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

      const ledgerEntry: StrictLedgerProto = {
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        creditAccountID1: isCreditorCounterparty ? transactionBusinessId : taxCategory,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? taxCategory : transactionBusinessId,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(valueDate.getTime());
      currencies.add(currency);
    }

    const { balanceSum } = getLedgerBalanceInfo(ledgerBalance);

    const miscLedgerEntries: LedgerProto[] = [];
    if (Math.abs(balanceSum) > 0.005) {
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

        const amount = Math.abs(balanceSum);

        const isCreditorCounterparty = balanceSum < 0;

        const ledgerEntry = {
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
        };

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      } else {
        throw new GraphQLError(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${hasForeignCurrency ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    const allowedUnbalancedBusinesses = new Set([TAX_DEDUCTIONS_BUSINESS_ID]);
    const ledgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses);

    // handle salary batched charges
    if (hasBatchedCounterparty) {
      // TODO: implement
      console.log('hasBatchedCounterparty');
    }

    return {
      records: [...accountingLedgerEntries, ...financialAccountLedgerEntries, ...miscLedgerEntries],
      balance: ledgerBalanceInfo,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
