import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { FundsProvider } from '@modules/salaries/providers/funds.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  BATCHED_EMPLOYEE_BUSINESS_ID,
  BATCHED_PENSION_BUSINESS_ID,
  DEFAULT_LOCAL_CURRENCY,
  SALARY_BATCHED_BUSINESSES,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import { generateEntriesFromSalaryRecords } from '../../helpers/salary-charge-ledger.helper.js';
import {
  generatePartialLedgerEntry,
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  ValidateTransaction,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';
import { UnbalancedBusinessesProvider } from '../../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecordsForCommonCharge } from './common-ledger-generation.resolver.js';

export const generateLedgerRecordsForSalary: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (charge, _args, context, _info) => {
  if (charge.business_array?.length === 1) {
    // for one business, use the default ledger generation
    return generateLedgerRecordsForCommonCharge(charge, _args, context, _info);
  }
  const chargeId = charge.id;
  const { injector } = context;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    let entriesPromises: Array<Promise<void>> = [];
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

    const salaryEntriesPromises = entries.map(async ledgerEntry => {
      accountingLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });
    entriesPromises.push(...salaryEntriesPromises);

    // generate monthly expenses ledger entries
    const monthlyEntriesPromises = monthlyEntriesProto
      .filter(({ amount }) => amount !== 0)
      .map(async ({ taxCategoryId, amount, isCredit }) => {
        const taxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByIDsLoader.load(taxCategoryId);
        if (!taxCategory) {
          throw new GraphQLError(`Tax category "${taxCategoryId}" not found`);
        }

        const ledgerEntry: LedgerProto = {
          id: taxCategoryId,
          invoiceDate: transactionDate,
          valueDate: transactionDate,
          currency: DEFAULT_LOCAL_CURRENCY,
          ...(isCredit ? { creditAccountID1: taxCategoryId } : { debitAccountID1: taxCategoryId }),
          localCurrencyCreditAmount1: amount,
          localCurrencyDebitAmount1: amount,
          description: `${month} salary: ${taxCategory.name}`,
          isCreditorCounterparty: false,
          ownerId: charge.owner_id,
          chargeId,
        };

        accountingLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      });
    entriesPromises.push(...monthlyEntriesPromises);

    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    // generate ledger from main transactions
    const batchedTransactionEntriesMaterials: {
      transaction: ValidateTransaction;
      partialEntry: Omit<StrictLedgerProto, 'debitAccountID1' | 'creditAccountID1'>;
      taxCategoryId: string;
    }[] = [];

    // for each common transaction, create a ledger record
    const financialAccountLedgerEntries: LedgerProto[] = [];
    const transactionEntriesPromises = mainTransactions.map(async preValidatedTransaction => {
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

      if (transaction.business_id && SALARY_BATCHED_BUSINESSES.includes(transaction.business_id)) {
        batchedTransactionEntriesMaterials.push({
          transaction,
          partialEntry,
          taxCategoryId: taxCategory.id,
        });
        return;
      }

      const ledgerEntry: StrictLedgerProto = {
        ...partialEntry,
        ...(partialEntry.isCreditorCounterparty
          ? {
              creditAccountID1: transaction.business_id,
              debitAccountID1: taxCategory.id,
            }
          : {
              creditAccountID1: taxCategory.id,
              debitAccountID1: transaction.business_id,
            }),
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });
    entriesPromises.push(...transactionEntriesPromises);

    await Promise.all(entriesPromises);

    // for each batched transaction, create a ledger record
    const batchedLedgerEntries: LedgerProto[] = [];
    entriesPromises = [];
    const batchedTransactionEntriesPromises = batchedTransactionEntriesMaterials.map(
      async ({ transaction, partialEntry, taxCategoryId }) => {
        const unbatchedBusinesses: Array<string> = [];
        switch (transaction.business_id) {
          case BATCHED_EMPLOYEE_BUSINESS_ID: {
            const employees = await injector
              .get(EmployeesProvider)
              .getEmployeesByEmployerLoader.load(charge.owner_id);
            unbatchedBusinesses.push(...employees.map(({ business_id }) => business_id));
            break;
          }
          case BATCHED_PENSION_BUSINESS_ID: {
            const funds = await injector.get(FundsProvider).getAllFunds();
            unbatchedBusinesses.push(...funds.map(({ id }) => id));
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
            accountingLedgerEntry.creditAccountID1
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
                  debitAccountID1: taxCategoryId,
                }
              : {
                  creditAccountID1: taxCategoryId,
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
      },
    );
    entriesPromises.push(...batchedTransactionEntriesPromises);

    // create a ledger record for fee transactions
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntriesPromises = feeTransactions.map(async transaction => {
      await getEntriesFromFeeTransaction(transaction, charge, context).then(ledgerEntries => {
        feeFinancialAccountLedgerEntries.push(...ledgerEntries);
        ledgerEntries.map(ledgerEntry => {
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        });
      });
    });
    entriesPromises.push(...feeFinancialAccountLedgerEntriesPromises);

    await Promise.all(entriesPromises);

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      allowedUnbalancedBusinesses,
    );

    const records = [
      ...accountingLedgerEntries,
      ...financialAccountLedgerEntries,
      ...batchedLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
    ];
    await storeInitialGeneratedRecords(charge, records, injector);

    return {
      records: ledgerProtoToRecordsConverter(records),
      charge,
      balance: ledgerBalanceInfo,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
