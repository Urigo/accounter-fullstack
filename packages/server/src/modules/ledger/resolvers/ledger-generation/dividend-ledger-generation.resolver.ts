import { DividendsProvider } from '@modules/dividends/providers/dividends.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { ledgerEntryFromBalanceCancellation } from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { BalanceCancellationProvider } from '@modules/ledger/providers/balance-cancellation.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import { DIVIDEND_WITHHOLDING_TAX_PERCENTAGE } from '../../../../shared/constants.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import { splitDividendTransactions } from '../../helpers/dividend-ledger.helper.js';
import { getEntriesFromFeeTransaction } from '../../helpers/fee-transactions.js';
import {
  generatePartialLedgerEntry,
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForDividend: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      dividends: { dividendWithholdingTaxBusinessId, dividendTaxCategoryId },
    },
  } = context;
  if (!dividendWithholdingTaxBusinessId) {
    return {
      __typename: 'CommonError',
      message: `Dividend withholding tax business ID is not defined`,
    };
  }
  if (!dividendTaxCategoryId) {
    return {
      __typename: 'CommonError',
      message: `Dividend tax category ID is not defined`,
    };
  }

  const chargeId = charge.id;

  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    // generate ledger from transactions
    const coreLedgerEntries: StrictLedgerProto[] = [];
    const withholdingTaxLedgerEntries: LedgerProto[] = [];
    const paymentLedgerEntries: LedgerProto[] = [];
    const miscLedgerEntries: LedgerProto[] = [];
    let mainAccountId: string | undefined = undefined;

    // Get all transactions
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

    const chargeBallanceCancellationsPromise = injector
      .get(BalanceCancellationProvider)
      .getBalanceCancellationByChargesIdLoader.load(chargeId);

    const [transactions, balanceCancellations] = await Promise.all([
      transactionsPromise,
      chargeBallanceCancellationsPromise,
    ]);

    const {
      withholdingTaxTransactions,
      paymentsTransactions,
      feeTransactions,
      errors: splitErrors,
    } = splitDividendTransactions(transactions, context);

    splitErrors.map(errors.add);

    // create a ledger record for tax deduction origin
    const withholdingTaxTransactionsPromises = withholdingTaxTransactions.map(
      async preValidatedTransaction => {
        try {
          const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
          if (transaction.currency !== defaultLocalCurrency) {
            errors.add(
              `Withholding tax currency supposed to be local, got ${transaction.currency}`,
            );
          }

          // get tax category
          const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
            injector,
            transaction,
          );

          // set main account for dividend
          mainAccountId ||= financialAccountTaxCategoryId;
          if (mainAccountId !== financialAccountTaxCategoryId) {
            errors.add(`Tax category is not consistent`);
          }

          const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, undefined);
          const ledgerEntry: LedgerProto = {
            ...partialEntry,
            creditAccountID1: partialEntry.isCreditorCounterparty
              ? transaction.business_id
              : financialAccountTaxCategoryId,
            debitAccountID1: partialEntry.isCreditorCounterparty
              ? financialAccountTaxCategoryId
              : transaction.business_id,
          };

          withholdingTaxLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        } catch (e) {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        }
      },
    );

    const dividendRecordsPromise = injector
      .get(DividendsProvider)
      .getDividendsByChargeIdLoader.load(chargeId);

    const [dividendRecords] = await Promise.all([
      dividendRecordsPromise,
      ...withholdingTaxTransactionsPromises,
    ]);

    const allowedUnbalancedBusinesses = new Set<string>();

    // create a ledger record for dividend payments
    const coreLedgerEntriesPromises = paymentsTransactions.map(async preValidatedTransaction => {
      try {
        const dividendRecord = dividendRecords.find(
          record => record.transaction_id === preValidatedTransaction.id,
        );

        // run validations
        if (!dividendRecord) {
          throw new LedgerError(
            `Transaction reference "${preValidatedTransaction.source_reference}" is missing matching dividend record`,
          );
        }
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
        if (Number(transaction.amount) >= 0) {
          throw new LedgerError(
            `Dividend transaction amount cannot be positive (reference: ${transaction.source_reference})`,
          );
        }
        if (Number(dividendRecord.amount) <= 0) {
          throw new LedgerError(`Dividend amount is not positive (ID: ${dividendRecord.id})`);
        }
        if (charge.owner_id !== dividendRecord.owner_id) {
          throw new LedgerError(
            `Transaction reference "${transaction.source_reference}" is not matching dividend record ID="${dividendRecord.id}"`,
          );
        }

        const withholdingTaxPercentage = dividendRecord.withholding_tax_percentage_override
          ? Number(dividendRecord.withholding_tax_percentage_override)
          : DIVIDEND_WITHHOLDING_TAX_PERCENTAGE;
        const dividendRecordAbsAmount = Math.abs(Number(dividendRecord.amount));

        // generate core ledger entries
        const coreLedgerEntry: StrictLedgerProto = {
          currency: defaultLocalCurrency,
          ownerId: dividendRecord.owner_id,
          id: dividendRecord.id,
          chargeId,
          invoiceDate: dividendRecord.date,
          valueDate: dividendRecord.date,
          isCreditorCounterparty: false,
          description: 'Main dividend record',
          debitAccountID1: dividendTaxCategoryId,
          localCurrencyDebitAmount1: dividendRecordAbsAmount,
          creditAccountID1: dividendRecord.business_id,
          localCurrencyCreditAmount1: dividendRecordAbsAmount * (1 - withholdingTaxPercentage),
          creditAccountID2: dividendWithholdingTaxBusinessId,
          localCurrencyCreditAmount2: dividendRecordAbsAmount * withholdingTaxPercentage,
        };

        coreLedgerEntries.push(coreLedgerEntry);
        updateLedgerBalanceByEntry(coreLedgerEntry, ledgerBalance, context);

        // preparations for payment ledger entries
        let exchangeRate: number | undefined = undefined;
        if (transaction.currency !== defaultLocalCurrency) {
          // get exchange rate for currency
          exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(transaction.currency, defaultLocalCurrency, dividendRecord.date);
        }

        const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);

        const isForeignCurrency = partialEntry.currency !== defaultLocalCurrency;
        const amountDiff =
          partialEntry.localCurrencyCreditAmount1 -
          Number(dividendRecord.amount) * (1 - withholdingTaxPercentage);
        if (Math.abs(amountDiff) > 0.005 && !isForeignCurrency) {
          throw new LedgerError(
            `Transaction reference "${transaction.source_reference}" and dividend record ID="${dividendRecord.id}" amounts mismatch`,
          );
        }

        const foreignAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
          injector,
          transaction,
        );

        // create payment ledger entries
        const paymentEntry: LedgerProto = {
          ...partialEntry,
          isCreditorCounterparty: false,
          creditAccountID1: foreignAccountTaxCategoryId,
          debitAccountID1: dividendRecord.business_id,
        };

        paymentLedgerEntries.push(paymentEntry);
        updateLedgerBalanceByEntry(paymentEntry, ledgerBalance, context);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });

    // create a ledger record for fee transactions
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      await getEntriesFromFeeTransaction(transaction, charge, context)
        .then(ledgerEntries => {
          feeFinancialAccountLedgerEntries.push(...ledgerEntries);
          ledgerEntries.map(ledgerEntry => {
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
          });
        })
        .catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });
    });

    const entriesPromises = [...feeTransactionsPromises, ...coreLedgerEntriesPromises];

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, context)
      .then(entries => {
        entries.map(entry => {
          entry.ownerId = charge.owner_id;
          miscLedgerEntries.push(entry);
          updateLedgerBalanceByEntry(entry, ledgerBalance, context);
        });
      })
      .catch(e => {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          errors.add(`Failed to generate misc expenses ledger: ${e.message}`);
        }
      });
    entriesPromises.push(expensesLedgerPromise);

    await Promise.all(entriesPromises);

    // create foreign currency balance ledger
    for (const entry of paymentLedgerEntries) {
      if (entry.currency !== defaultLocalCurrency) {
        const currencyBalanceEntry1: LedgerProto = {
          id: entry.id + `|${entry.currency}-balance`, // NOTE: this field is dummy
          creditAccountID1: entry.debitAccountID1,
          localCurrencyCreditAmount1: entry.localCurrencyCreditAmount1,
          localCurrencyDebitAmount1: entry.localCurrencyCreditAmount1,
          creditAmount1: entry.creditAmount1,
          description: `Foreign currency balance (${entry.currency})`,
          isCreditorCounterparty: true,
          invoiceDate: entry.invoiceDate,
          valueDate: entry.valueDate,
          currency: entry.currency,
          ownerId: entry.ownerId,
          chargeId: charge.id,
        };

        miscLedgerEntries.push(currencyBalanceEntry1);
        updateLedgerBalanceByEntry(currencyBalanceEntry1, ledgerBalance, context);

        const currencyBalanceEntry2: LedgerProto = {
          id: entry.id + `|${defaultLocalCurrency}-balance`, // NOTE: this field is dummy
          debitAccountID1: entry.debitAccountID1,
          localCurrencyCreditAmount1: entry.localCurrencyCreditAmount1,
          localCurrencyDebitAmount1: entry.localCurrencyCreditAmount1,
          description: `Foreign currency balance (${defaultLocalCurrency})`,
          isCreditorCounterparty: false,
          invoiceDate: entry.invoiceDate,
          valueDate: entry.valueDate,
          currency: defaultLocalCurrency,
          ownerId: entry.ownerId,
          chargeId: charge.id,
        };

        miscLedgerEntries.push(currencyBalanceEntry2);
        updateLedgerBalanceByEntry(currencyBalanceEntry2, ledgerBalance, context);
      }
    }

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      try {
        const ledgerEntry = ledgerEntryFromBalanceCancellation(
          balanceCancellation,
          ledgerBalance,
          coreLedgerEntries,
          chargeId,
          charge.owner_id,
          context,
        );

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
          continue;
        } else {
          throw e;
        }
      }
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );

    const records = [
      ...withholdingTaxLedgerEntries,
      ...coreLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...paymentLedgerEntries,
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
