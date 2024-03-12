import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { BalanceCancellationProvider } from '@modules/ledger/providers/balance-cancellation.provider.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { FundsProvider } from '@modules/salaries/providers/funds.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  BALANCE_CANCELLATION_TAX_CATEGORY_ID,
  BATCHED_EMPLOYEE_BUSINESS_ID,
  BATCHED_PENSION_BUSINESS_ID,
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_TAX_CATEGORY_ID,
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

    const chargeBallanceCancellationsPromise = injector
      .get(BalanceCancellationProvider)
      .getBalanceCancellationByChargesIdLoader.load(chargeId);

    const [salaryRecords, transactions, unbalancedBusinesses, balanceCancellations] =
      await Promise.all([
        salaryRecordsPromise,
        transactionsPromise,
        unbalancedBusinessesPromise,
        chargeBallanceCancellationsPromise,
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

    const miscLedgerEntries: LedgerProto[] = [];

    // Add exchange ledger in case of foreign currency salaries
    for (const entry of accountingLedgerEntries) {
      const businessId = entry.creditAccountID1;
      const matchingTransaction = financialAccountLedgerEntries.find(
        entry =>
          businessId ===
          (entry.isCreditorCounterparty ? entry.creditAccountID1 : entry.debitAccountID1),
      );
      if (!matchingTransaction || !businessId) {
        continue;
      }

      const balance =
        (matchingTransaction?.localCurrencyCreditAmount1 ?? 0) *
          (matchingTransaction?.isCreditorCounterparty ? -1 : 1) -
        entry.localCurrencyCreditAmount1;
      if (balance === 0) {
        continue;
      }

      const datesDiff = entry.invoiceDate.getTime() !== matchingTransaction?.invoiceDate.getTime();
      if (!datesDiff) {
        continue;
      }

      const currencyDiff = entry.currency !== matchingTransaction.currency;
      if (!currencyDiff) {
        continue;
      }

      const amount = Math.abs(balance);
      const isCreditorCounterparty = balance > 0;

      const ledgerEntry: StrictLedgerProto = {
        id: matchingTransaction.id + '|fee', // NOTE: this field is dummy
        creditAccountID1: isCreditorCounterparty ? businessId : EXCHANGE_RATE_TAX_CATEGORY_ID,
        localCurrencyCreditAmount1: amount,
        debitAccountID1: isCreditorCounterparty ? EXCHANGE_RATE_TAX_CATEGORY_ID : businessId,
        localCurrencyDebitAmount1: amount,
        description: 'Exchange ledger record',
        isCreditorCounterparty,
        invoiceDate: matchingTransaction.invoiceDate,
        valueDate: entry.valueDate,
        currency: matchingTransaction.currency, // NOTE: this field is dummy
        ownerId: matchingTransaction.ownerId,
        chargeId,
      };
      miscLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

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

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      const entityBalance = ledgerBalance.get(balanceCancellation.business_id);
      if (!entityBalance) {
        console.log(
          `Balance cancellation for business ${balanceCancellation.business_id} redundant - already balanced`,
        );
        continue;
      }

      const { amount, entityId } = entityBalance;

      const financialAccountEntry = financialAccountLedgerEntries.find(entry =>
        [
          entry.creditAccountID1,
          entry.creditAccountID2,
          entry.debitAccountID1,
          entry.debitAccountID2,
        ].includes(balanceCancellation.business_id),
      );
      if (!financialAccountEntry) {
        throw new GraphQLError(
          `Balance cancellation for business ${balanceCancellation.business_id} failed - no financial account entry found`,
        );
      }

      let foreignAmount: number | undefined = undefined;

      if (
        financialAccountEntry.currency !== DEFAULT_LOCAL_CURRENCY &&
        financialAccountEntry.currencyRate
      ) {
        foreignAmount = financialAccountEntry.currencyRate * amount;
      }

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: LedgerProto = {
        id: balanceCancellation.charge_id,
        invoiceDate: financialAccountEntry.invoiceDate,
        valueDate: financialAccountEntry.valueDate,
        currency: financialAccountEntry.currency,
        creditAccountID1: isCreditorCounterparty ? BALANCE_CANCELLATION_TAX_CATEGORY_ID : entityId,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? entityId : BALANCE_CANCELLATION_TAX_CATEGORY_ID,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: balanceCancellation.description ?? undefined,
        reference1: financialAccountEntry.reference1,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: financialAccountEntry.currencyRate,
        chargeId,
      };

      miscLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

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
      ...miscLedgerEntries,
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
