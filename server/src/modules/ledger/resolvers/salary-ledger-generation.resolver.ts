import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  BATCHED_EMPLOYEE_BUSINESS_ID,
  BATCHED_PENSION_BUSINESS_ID,
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_CATEGORY_NAME,
  SALARY_BATCHED_BUSINESSES,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { CounterAccountProto, LedgerProto, StrictLedgerProto } from '@shared/types';
import { generateEntriesFromSalaryRecords } from '../helpers/salary-charge-ledger.helper.js';
import {
  generatePartialLedgerEntry,
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../helpers/utils.helper.js';
import { SalariesLedgerProvider } from '../providers/salaries-ledger.provider.js';
import { UnbalancedBusinessesProvider } from '../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecords } from './ledger-generation.resolver.js';

export const generateLedgerRecordsForSalary: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _args, { injector }, _info) => {
  if (charge.business_array?.length === 1) {
    // for one business, use the default ledger generation
    return generateLedgerRecords(charge, _args, { injector }, _info);
  }
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
      throw new GraphQLError(`Charge ID="${chargeId}" is missing transaction date`);
    }

    // Get relevant data for generation
    const salaryRecordsPromise = injector
      .get(SalariesProvider)
      .getSalaryRecordsByChargeIdLoader.load(chargeId);
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const unbalancedBusinessesPromise = injector
      .get(UnbalancedBusinessesProvider)
      .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);
    const [salaryRecords, transactions, unbalancedBusinesses] = await Promise.all([
      salaryRecordsPromise,
      transactionsPromise,
      unbalancedBusinessesPromise,
    ]);

    // generate ledger from salary records
    const { entries, monthlyEntriesProto, month } = generateEntriesFromSalaryRecords(
      salaryRecords,
      charge,
      transactionDate,
    );

    for (const ledgerEntry of entries) {
      accountingLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(ledgerEntry.valueDate.getTime());
    }
    currencies.add(DEFAULT_LOCAL_CURRENCY);

    // generate monthly expenses ledger entries
    const monthlyEntries = await Promise.all(
      monthlyEntriesProto
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

    for (const ledgerEntry of monthlyEntries) {
      accountingLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(ledgerEntry.valueDate.getTime());
    }

    // generate ledger from transactions
    const batchedLedgerEntries: LedgerProto[] = [];

    const transactionEntriesMaterials = await Promise.all(
      transactions.map(async preValidatedTransaction => {
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

        // preparations for core ledger entries
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

        const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

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

        return { transaction, partialEntry, taxCategory };
      }),
    );

    const { commonTransactionEntriesMaterials, batchedTransactionEntriesMaterials } =
      transactionEntriesMaterials.reduce<{
        commonTransactionEntriesMaterials: typeof transactionEntriesMaterials;
        batchedTransactionEntriesMaterials: typeof transactionEntriesMaterials;
      }>(
        (acc, transaction) => {
          if (
            transaction.transaction.business_id &&
            SALARY_BATCHED_BUSINESSES.includes(transaction.transaction.business_id)
          ) {
            acc.batchedTransactionEntriesMaterials.push(transaction);
          } else {
            acc.commonTransactionEntriesMaterials.push(transaction);
          }

          return acc;
        },
        { commonTransactionEntriesMaterials: [], batchedTransactionEntriesMaterials: [] },
      );

    // for each common transaction, create a ledger record
    const financialAccountLedgerEntries: LedgerProto[] = [];
    for (const { transaction, partialEntry, taxCategory } of commonTransactionEntriesMaterials) {
      const ledgerEntry: StrictLedgerProto = {
        ...partialEntry,
        ...(partialEntry.isCreditorCounterparty
          ? {
              creditAccountID1: transaction.business_id,
              debitAccountID1: taxCategory,
            }
          : {
              creditAccountID1: taxCategory,
              debitAccountID1: transaction.business_id,
            }),
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      dates.add(partialEntry.valueDate.getTime());
      currencies.add(transaction.currency);
    }

    // for each batched transaction, create a ledger record
    for (const { transaction, partialEntry, taxCategory } of batchedTransactionEntriesMaterials) {
      const unbatchedBusinesses: Array<string> = [];
      switch (transaction.business_id) {
        case BATCHED_EMPLOYEE_BUSINESS_ID: {
          const employees = await injector
            .get(SalariesLedgerProvider)
            .getChargeByFinancialEntityIdLoader.load(charge.owner_id);
          unbatchedBusinesses.push(...employees.map(({ business_id }) => business_id));
          break;
        }
        case BATCHED_PENSION_BUSINESS_ID: {
          const employees = await injector.get(SalariesLedgerProvider).getAllFunds();
          unbatchedBusinesses.push(...employees.map(({ id }) => id));
          break;
        }
        default: {
          throw new GraphQLError(
            `Business ID="${transaction.business_id}" is not supported as batched ID`,
          );
        }
      }

      const batchedEntries = accountingLedgerEntries
        .filter(accountingLedgerEntry =>
          typeof accountingLedgerEntry.creditAccountID1 === 'string'
            ? unbatchedBusinesses.includes(accountingLedgerEntry.creditAccountID1)
            : false,
        )
        .map(accountingLedgerEntry => {
          const externalPayments = financialAccountLedgerEntries
            .filter(
              financialAccountEntry =>
                !!financialAccountEntry.debitAccountID1 &&
                accountingLedgerEntry.creditAccountID1 === financialAccountEntry.debitAccountID1,
            )
            .map(entry => entry.localCurrencyCreditAmount1)
            .reduce((a, b) => a + b, 0);
          if (externalPayments === 0) {
            return accountingLedgerEntry;
          }
          if (externalPayments < accountingLedgerEntry.localCurrencyCreditAmount1) {
            return {
              ...accountingLedgerEntry,
              localCurrencyCreditAmount1:
                accountingLedgerEntry.localCurrencyCreditAmount1 - externalPayments,
              localCurrencyDebitAmount1:
                accountingLedgerEntry.localCurrencyDebitAmount1 - externalPayments,
            };
          }
          return {
            ...accountingLedgerEntry,
            localCurrencyCreditAmount1:
              externalPayments - accountingLedgerEntry.localCurrencyCreditAmount1,
            creditAccountID1: accountingLedgerEntry.debitAccountID1,
            localCurrencyDebitAmount1:
              externalPayments - accountingLedgerEntry.localCurrencyDebitAmount1,
            debitAccountID1: accountingLedgerEntry.creditAccountID1,
          };
        });

      const balance = batchedEntries
        .map(entry => entry.localCurrencyCreditAmount1)
        .reduce((a, b) => a + b, 0);
      if (balance !== partialEntry.localCurrencyCreditAmount1) {
        throw new GraphQLError(
          `Batched business ID="${transaction.business_id}" cannot be unbatched as it is not balanced`,
        );
      }

      for (const batchedEntry of batchedEntries) {
        const ledgerEntry: StrictLedgerProto = {
          ...partialEntry,
          ...(partialEntry.isCreditorCounterparty
            ? {
                creditAccountID1: batchedEntry.creditAccountID1!,
                debitAccountID1: taxCategory,
              }
            : {
                creditAccountID1: taxCategory,
                debitAccountID1: batchedEntry.creditAccountID1!,
              }),
          creditAmount1: batchedEntry.creditAmount1,
          localCurrencyCreditAmount1: batchedEntry.localCurrencyCreditAmount1,
          debitAmount1: batchedEntry.creditAmount1,
          localCurrencyDebitAmount1: batchedEntry.localCurrencyCreditAmount1,
        };

        batchedLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }
      dates.add(partialEntry.valueDate.getTime());
      currencies.add(transaction.currency);
    }

    const tempLedgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance);

    const miscLedgerEntries: LedgerProto[] = [];
    if (Math.abs(tempLedgerBalanceInfo.balanceSum) > 1) {
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

        const amount = Math.abs(tempLedgerBalanceInfo.balanceSum);

        const isCreditorCounterparty = tempLedgerBalanceInfo.balanceSum < 0;

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

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );
    const ledgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses);

    return {
      records: [
        ...accountingLedgerEntries,
        ...financialAccountLedgerEntries,
        ...batchedLedgerEntries,
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
