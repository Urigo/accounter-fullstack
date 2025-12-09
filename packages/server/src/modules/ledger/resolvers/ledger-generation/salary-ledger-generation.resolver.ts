import { lastDayOfMonth } from 'date-fns';
import { getChargeBusinesses } from '@modules/charges/helpers/common.helper.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { validateExchangeRate } from '@modules/ledger/helpers/exchange-ledger.helper.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { BalanceCancellationProvider } from '@modules/ledger/providers/balance-cancellation.provider.js';
import { EmployeesProvider } from '@modules/salaries/providers/employees.provider.js';
import { FundsProvider } from '@modules/salaries/providers/funds.provider.js';
import { SalariesProvider } from '@modules/salaries/providers/salaries.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import { generateEntriesFromSalaryRecords } from '../../helpers/salary-charge-ledger.helper.js';
import {
  generatePartialLedgerEntry,
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
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
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context, _info) => {
  const { allBusinessIds } = await getChargeBusinesses(charge.id, context.injector);
  if (allBusinessIds.length === 1) {
    // for one business, use the default ledger generation
    return generateLedgerRecordsForCommonCharge(
      charge,
      { insertLedgerRecordsIfNotExists },
      context,
      _info,
    );
  }
  const chargeId = charge.id;
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      general: {
        taxCategories: { balanceCancellationTaxCategoryId, exchangeRateTaxCategoryId },
      },
      salaries: { batchedFundsBusinessId, batchedEmployeesBusinessId, salaryBatchedBusinessIds },
    },
  } = context;
  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    let entriesPromises: Array<Promise<void>> = [];
    const accountingLedgerEntries: LedgerProto[] = [];
    const foreignCurrencySalaryBusinesses = new Set<string>();

    // Get relevant data for generation
    const salaryRecordsPromise = injector
      .get(SalariesProvider)
      .getSalaryRecordsByChargeIdLoader.load(chargeId);

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

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
    try {
      const { entries, monthlyEntriesProto, month } = generateEntriesFromSalaryRecords(
        salaryRecords,
        charge,
        context,
      );

      entries.map(ledgerEntry => {
        accountingLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      });

      // generate monthly expenses ledger entries
      const monthlyEntriesPromises = monthlyEntriesProto
        .filter(({ amount }) => amount !== 0)
        .map(async ({ taxCategoryId, amount, isCredit }) => {
          const taxCategory = await injector
            .get(TaxCategoriesProvider)
            .taxCategoryByIdLoader.load(taxCategoryId);
          if (!taxCategory) {
            throw new LedgerError(`Tax category "${taxCategoryId}" not found`);
          }

          const ledgerEntry: LedgerProto = {
            id: taxCategoryId,
            invoiceDate: lastDayOfMonth(new Date(`${month}-01`)),
            valueDate: lastDayOfMonth(new Date(`${month}-01`)),
            currency: defaultLocalCurrency,
            ...(isCredit
              ? { creditAccountID1: taxCategoryId }
              : { debitAccountID1: taxCategoryId }),
            localCurrencyCreditAmount1: amount,
            localCurrencyDebitAmount1: amount,
            description: `${month} salary: ${taxCategory.name}`,
            isCreditorCounterparty: false,
            ownerId: charge.owner_id,
            chargeId,
          };

          accountingLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        });
      entriesPromises.push(...monthlyEntriesPromises);
    } catch (e) {
      if (e instanceof LedgerError) {
        errors.add(e.message);
      } else {
        throw e;
      }
    }

    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    // generate ledger from main transactions
    const batchedTransactionEntriesMaterials: {
      transaction: ValidateTransaction;
      partialEntry: Omit<StrictLedgerProto, 'debitAccountID1' | 'creditAccountID1'>;
      taxCategoryId: string;
    }[] = [];

    // for each common transaction, create a ledger record
    const financialAccountLedgerEntries: LedgerProto[] = [];
    const miscExpensesLedgerEntries: LedgerProto[] = [];
    const transactionEntriesPromises = mainTransactions.map(async preValidatedTransaction => {
      try {
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

        // preparations for core ledger entries
        let exchangeRate: number | undefined = undefined;
        if (transaction.currency !== defaultLocalCurrency) {
          // get exchange rate for currency
          exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(
              transaction.currency,
              defaultLocalCurrency,
              transaction.debit_timestamp,
            );
        }

        const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

        const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
          injector,
          transaction,
        );

        if (transaction.business_id && salaryBatchedBusinessIds.includes(transaction.business_id)) {
          batchedTransactionEntriesMaterials.push({
            transaction,
            partialEntry,
            taxCategoryId: financialAccountTaxCategoryId,
          });
          return;
        }

        const ledgerEntry: StrictLedgerProto = {
          ...partialEntry,
          ...(partialEntry.isCreditorCounterparty
            ? {
                creditAccountID1: transaction.business_id,
                debitAccountID1: financialAccountTaxCategoryId,
              }
            : {
                creditAccountID1: financialAccountTaxCategoryId,
                debitAccountID1: transaction.business_id,
              }),
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);

        // on foreign currency salary, update matching accounting ledger entry
        if (ledgerEntry.currency !== defaultLocalCurrency) {
          const matchingEntry = accountingLedgerEntries.find(accountingEntry => {
            return (
              transaction.business_id ===
              (accountingEntry.isCreditorCounterparty
                ? accountingEntry.debitAccountID1
                : accountingEntry.creditAccountID1)
            );
          });
          if (matchingEntry && matchingEntry.currency !== ledgerEntry.currency) {
            matchingEntry.currency = ledgerEntry.currency;
            matchingEntry.currencyRate = ledgerEntry.currencyRate;
            matchingEntry.creditAmount1 = ledgerEntry.creditAmount1;
            matchingEntry.debitAmount1 = ledgerEntry.debitAmount1;
            foreignCurrencySalaryBusinesses.add(transaction.business_id);
          }
        }
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });
    const miscExpensesEntriesPromise = generateMiscExpensesLedger(charge, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        miscExpensesLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, context);
      });
    });
    entriesPromises.push(...transactionEntriesPromises, miscExpensesEntriesPromise);

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
          (matchingTransaction?.isCreditorCounterparty ? 1 : -1) +
        entry.localCurrencyCreditAmount1;
      if (balance === 0) {
        continue;
      }

      const datesDiff = entry.invoiceDate.getTime() !== matchingTransaction?.invoiceDate.getTime();
      if (!datesDiff) {
        continue;
      }

      const currencyDiff = entry.currency !== matchingTransaction.currency;
      if (!currencyDiff && !foreignCurrencySalaryBusinesses.has(businessId)) {
        continue;
      }

      const amount = Math.abs(balance);
      const isCreditorCounterparty = balance < 0;

      // validate exchange rate
      const validation = validateExchangeRate(
        businessId,
        [...accountingLedgerEntries, ...financialAccountLedgerEntries],
        balance,
        defaultLocalCurrency,
      );
      if (validation === true) {
        const ledgerEntry: StrictLedgerProto = {
          id: matchingTransaction.id + '|fee', // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? businessId : exchangeRateTaxCategoryId,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? exchangeRateTaxCategoryId : businessId,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: matchingTransaction.invoiceDate,
          valueDate: entry.valueDate,
          currency: defaultLocalCurrency,
          ownerId: matchingTransaction.ownerId,
          chargeId,
        };
        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      } else {
        errors.add(validation);
      }
    }

    // for each batched transaction, create a ledger record
    const batchedLedgerEntries: LedgerProto[] = [];
    entriesPromises = [];
    const batchedTransactionEntriesPromises = batchedTransactionEntriesMaterials.map(
      async ({ transaction, partialEntry, taxCategoryId }) => {
        try {
          const unbatchedBusinesses: Array<string> = [];
          switch (transaction.business_id) {
            case batchedEmployeesBusinessId: {
              const employees = await injector
                .get(EmployeesProvider)
                .getEmployeesByEmployerLoader.load(charge.owner_id);
              unbatchedBusinesses.push(...employees.map(({ business_id }) => business_id));
              break;
            }
            case batchedFundsBusinessId: {
              const funds = await injector.get(FundsProvider).getAllFunds();
              unbatchedBusinesses.push(...funds.map(({ id }) => id));
              break;
            }
            default: {
              throw new LedgerError(
                `Business ID="${transaction.business_id}" is not supported as batched ID`,
              );
            }
          }

          const batchedEntries = [...accountingLedgerEntries, ...miscExpensesLedgerEntries]
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
                    accountingLedgerEntry.creditAccountID1 ===
                      financialAccountEntry.debitAccountID1,
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
            throw new LedgerError(
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
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
          }
        } catch (e) {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
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
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        });
      });
    });
    entriesPromises.push(...feeFinancialAccountLedgerEntriesPromises);

    await Promise.all(entriesPromises);

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      try {
        const entityBalance = ledgerBalance.get(balanceCancellation.business_id);
        if (!entityBalance) {
          throw new LedgerError(
            `Balance cancellation for business ${balanceCancellation.business_id} redundant - already balanced`,
          );
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
          throw new LedgerError(
            `Balance cancellation for business ${balanceCancellation.business_id} failed - no financial account entry found`,
          );
        }

        let foreignAmount: number | undefined = undefined;

        if (
          financialAccountEntry.currency !== defaultLocalCurrency &&
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
          creditAccountID1: isCreditorCounterparty ? balanceCancellationTaxCategoryId : entityId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? entityId : balanceCancellationTaxCategoryId,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: balanceCancellation.description ?? 'Balance Cancellation',
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: financialAccountEntry.currencyRate,
          chargeId,
        };

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    }

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );

    const records = [
      ...accountingLedgerEntries,
      ...financialAccountLedgerEntries,
      ...batchedLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscExpensesLedgerEntries,
      ...miscLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, context);
    }

    return {
      records: ledgerProtoToRecordsConverter(records),
      charge,
      balance: ledgerBalanceInfo,
      errors: Array.from(errors),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
