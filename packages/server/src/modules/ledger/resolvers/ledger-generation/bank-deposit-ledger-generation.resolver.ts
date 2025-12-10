import type {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import type { Currency } from '../../../../shared/enums.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
import { BankDepositTransactionsProvider } from '../../../bank-deposits/providers/bank-deposit-transactions.provider.js';
import { getChargeBusinesses } from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../transactions/types.js';
import { identifyInterestTransactionIds } from '../../helpers/bank-deposit-ledger-generation.helper.js';
import { ledgerEntryFromMainTransaction } from '../../helpers/common-charge-ledger.helper.js';
import { calculateExchangeRate } from '../../helpers/exchange-ledger.helper.js';
import {
  convertLedgerRecordToProto,
  storeInitialGeneratedRecords,
} from '../../helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../helpers/misc-expenses-ledger.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';

export const generateLedgerRecordsForBankDeposit: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  const chargeId = charge.id;
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      general: {
        taxCategories: { exchangeRateTaxCategoryId },
      },
    },
  } = context;

  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<
      string,
      {
        amount: number;
        entityId: string;
        foreignAmounts?: Partial<Record<Currency, { local: number; foreign: number }>>;
      }
    >();

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

    const bankDepositTransactionsPromise = injector
      .get(BankDepositTransactionsProvider)
      .getDepositTransactionsByChargeId(chargeId);

    const [transactions, bankDepositTransactions, { mainBusinessId }] = await Promise.all([
      transactionsPromise,
      bankDepositTransactionsPromise,
      getChargeBusinesses(chargeId, injector),
    ]);

    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const interestLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];

    let isWithdrawal = false;
    let isBreathingDeposit = false;

    // generate ledger from transactions
    const [mainTransaction, interestTransactions] = transactions.reduce(
      (
        [mainTransaction, interestTransactions]: [
          IGetTransactionsByChargeIdsResult,
          IGetTransactionsByChargeIdsResult[],
        ],
        current,
      ) => {
        if (mainTransaction.id === current.id) {
          return [mainTransaction, interestTransactions];
        }
        return Number(current.amount) > Number(mainTransaction.amount)
          ? [current, [mainTransaction, ...interestTransactions]]
          : [mainTransaction, [current, ...interestTransactions]];
      },
      [transactions[0], []],
    );

    if (Number(mainTransaction.amount) > 0) {
      isWithdrawal = true;
    }

    const mainTransactionPromise = async () =>
      ledgerEntryFromMainTransaction(
        mainTransaction,
        context,
        chargeId,
        charge.owner_id,
        mainBusinessId ?? undefined,
      )
        .then(ledgerEntry => {
          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        })
        .catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });

    // create a ledger record for fee transactions
    const interestTransactionsPromises = interestTransactions.map(async transaction => {
      // for each transaction, create a ledger record
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);

      const businessTaxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessAndOwnerIDsLoader.load({
          businessId: transactionBusinessId,
          ownerId: charge.owner_id,
        });
      if (!businessTaxCategory) {
        errors.add(`Business ID="${transactionBusinessId}" is missing tax category`);
        return;
      }

      let amount = Number(transaction.amount);
      let foreignAmount: number | undefined = undefined;

      if (currency !== defaultLocalCurrency) {
        // get exchange rate for currency
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultLocalCurrency, valueDate);

        foreignAmount = amount;
        // calculate amounts in ILS:
        amount = exchangeRate * amount;
      }

      const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: StrictLedgerProto = {
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        creditAccountID1: isCreditorCounterparty ? businessTaxCategory.id : accountTaxCategoryId,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? accountTaxCategoryId : businessTaxCategory.id,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference: transaction.origin_key,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId,
      };

      interestLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
    });

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        feeFinancialAccountLedgerEntries.push(entry);
        updateLedgerBalanceByEntry(entry, ledgerBalance, context);
      });
    });

    entriesPromises.push(
      mainTransactionPromise(),
      ...interestTransactionsPromises,
      expensesLedgerPromise,
    );

    await Promise.all(entriesPromises);

    const miscLedgerEntries: StrictLedgerProto[] = [];

    const miscLedgerEntriesPromise = async () => {
      const mainLedgerEntry = financialAccountLedgerEntries[0];
      if (!mainLedgerEntry) {
        throw new LedgerError('Main ledger entry not found');
      }

      const depositTransactions = bankDepositTransactions.filter(t => Number(t.amount) < 0);
      if (depositTransactions.length === 0 && isWithdrawal) {
        throw new LedgerError('Deposit transaction not found');
      }
      if (depositTransactions.length > 1) {
        isBreathingDeposit = true;

        // Validate consistent currency
        const depositCurrency = depositTransactions[0].currency as Currency;
        for (const tx of depositTransactions) {
          if (tx.currency !== depositCurrency) {
            throw new LedgerError(
              `Deposit has inconsistent currencies: found ${tx.currency} and ${depositCurrency}`,
            );
          }
        }

        // If currency is local, no revaluation needed
        if (depositCurrency === defaultLocalCurrency) {
          return;
        }

        // Filter out interest transactions via shared helper
        const interestTransactionIds = identifyInterestTransactionIds(depositTransactions, {
          getId: tx => tx.id,
          getChargeId: tx => tx.charge_id,
          getAmount: tx => Number(tx.amount),
        });

        const nonInterestTransactions = depositTransactions.filter(
          tx => !interestTransactionIds.has(tx.id),
        );

        // Find latest deposit/withdrawal transaction prior to current
        const mainTxDate = mainTransaction.debit_date ?? mainTransaction.event_date;
        const prevTransactions = nonInterestTransactions.filter(tx => {
          const txDate = tx.debit_date ?? tx.event_date;
          if (txDate < mainTxDate) {
            return true;
          }
          if (txDate.getTime() === mainTxDate.getTime()) {
            // Same date: use ID ordering
            return tx.id < mainTransaction.id;
          }
          return false;
        });

        if (prevTransactions.length === 0) {
          throw new LedgerError('No previous deposit transaction found for revaluation');
        }

        // Sort by date desc, then by id desc to get the latest
        prevTransactions.sort((a, b) => {
          const dateA = a.debit_date ?? a.event_date;
          const dateB = b.debit_date ?? b.event_date;
          if (dateB.getTime() !== dateA.getTime()) {
            return dateB.getTime() - dateA.getTime();
          }
          return b.id.localeCompare(a.id);
        });

        const prevAction = prevTransactions[0];
        const prevActionDate = prevAction.debit_date ?? prevAction.event_date;

        // Calculate origin balance at prev action (sum of all non-interest up to and including prev action)
        let originBalance = 0;
        for (const tx of nonInterestTransactions) {
          const txDate = tx.debit_date ?? tx.event_date;
          if (
            txDate < prevActionDate ||
            (txDate.getTime() === prevActionDate.getTime() && tx.id <= prevAction.id)
          ) {
            originBalance += Number(tx.amount);
          }
        }

        // Get exchange rate for prev action and calculate prev action local balance
        const prevExchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(depositCurrency, defaultLocalCurrency, prevActionDate);
        const prevLocalBalance = originBalance * prevExchangeRate;

        // Get current exchange rate
        const currentExchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(depositCurrency, defaultLocalCurrency, mainLedgerEntry.valueDate);

        // Calculate revaluation: (origin balance * current rate) - prev local balance
        const rawRevaluationAmount = originBalance * currentExchangeRate - prevLocalBalance;
        const revaluationAmount = Math.abs(rawRevaluationAmount);

        if (revaluationAmount > 0) {
          const isCreditorCounterparty = rawRevaluationAmount > 0;
          const mainAccountId = mainLedgerEntry.creditAccountID1;

          const revaluationLedgerEntry: StrictLedgerProto = {
            id: mainTransaction.id + '|revaluation',
            creditAccountID1: isCreditorCounterparty ? mainAccountId : exchangeRateTaxCategoryId,
            localCurrencyCreditAmount1: revaluationAmount,
            debitAccountID1: isCreditorCounterparty ? exchangeRateTaxCategoryId : mainAccountId,
            localCurrencyDebitAmount1: revaluationAmount,
            description: 'Revaluation ledger record',
            isCreditorCounterparty,
            invoiceDate: mainLedgerEntry.valueDate,
            valueDate: mainLedgerEntry.valueDate,
            currency: defaultLocalCurrency,
            ownerId: mainLedgerEntry.ownerId,
            chargeId,
          };

          miscLedgerEntries.push(revaluationLedgerEntry);
          updateLedgerBalanceByEntry(revaluationLedgerEntry, ledgerBalance, context);
        }
      } else if (isWithdrawal) {
        const mainBusinessBalance = mainTransaction.business_id
          ? ledgerBalance.get(mainTransaction.business_id)
          : undefined;
        const mainBusinessBalanceByCurrency =
          mainTransaction.currency === defaultLocalCurrency
            ? mainBusinessBalance?.amount
            : mainBusinessBalance?.foreignAmounts?.[mainTransaction.currency]?.foreign;
        const mainBusinessAbsBalance = mainBusinessBalanceByCurrency
          ? Math.abs(mainBusinessBalanceByCurrency)
          : undefined;

        const initialDepositTransaction = depositTransactions[0];
        const depositTransactionAmount = Math.abs(Number(initialDepositTransaction.amount));

        if (
          mainBusinessAbsBalance !== depositTransactionAmount ||
          mainTransaction.currency !== initialDepositTransaction.currency
        ) {
          throw new LedgerError('Deposit transaction does not match the withdrawal transaction');
        }

        const depositLedgerRecords = await injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(initialDepositTransaction.charge_id);

        if (depositLedgerRecords.length !== 1) {
          if (depositLedgerRecords.length === 0) {
            throw new LedgerError('Deposit ledger record not found');
          }
          throw new LedgerError('Multiple deposit ledger records found');
        }
        const depositLedgerRecord = depositLedgerRecords[0];

        if (Number.isNaN(depositLedgerRecord.credit_local_amount1)) {
          throw new LedgerError('Deposit ledger record has invalid local amount');
        }

        if (depositLedgerRecord.debit_entity1) {
          updateLedgerBalanceByEntry(
            convertLedgerRecordToProto(depositLedgerRecord, context),
            ledgerBalance,
            context,
          );
        }
        if (mainTransaction.currency !== defaultLocalCurrency) {
          const rawAmount =
            Number(depositLedgerRecord.credit_local_amount1) -
            mainLedgerEntry.localCurrencyCreditAmount1;
          const amount = Math.abs(rawAmount);
          const isCreditorCounterparty = rawAmount > 0;
          const mainAccountId = mainLedgerEntry.creditAccountID1;

          // validate exchange rate
          try {
            const exchangeAmount = calculateExchangeRate(
              mainLedgerEntry.creditAccountID1,
              [
                ...financialAccountLedgerEntries,
                convertLedgerRecordToProto(depositLedgerRecord, context),
              ],
              defaultLocalCurrency,
            );
            if (
              (!exchangeAmount && !!amount) ||
              (exchangeAmount && Math.abs(exchangeAmount) !== amount)
            ) {
              throw new LedgerError('Exchange rate error');
            }
          } catch (e) {
            errors.add((e as Error).message);
          }

          const exchangeLedgerEntry: StrictLedgerProto = {
            id: mainTransaction.id + '|fee', // NOTE: this field is dummy
            creditAccountID1: isCreditorCounterparty ? mainAccountId : exchangeRateTaxCategoryId,
            localCurrencyCreditAmount1: amount,
            debitAccountID1: isCreditorCounterparty ? exchangeRateTaxCategoryId : mainAccountId,
            localCurrencyDebitAmount1: amount,
            description: 'Exchange ledger record',
            isCreditorCounterparty,
            invoiceDate: mainLedgerEntry.valueDate,
            valueDate: mainLedgerEntry.valueDate,
            currency: defaultLocalCurrency,
            ownerId: mainLedgerEntry.ownerId,
            chargeId,
          };
          miscLedgerEntries.push(exchangeLedgerEntry);
          updateLedgerBalanceByEntry(exchangeLedgerEntry, ledgerBalance, context);
        }
      }

      return;
    };

    await miscLedgerEntriesPromise().catch(e => {
      if (e instanceof LedgerError) {
        errors.add(e.message);
      } else {
        throw e;
      }
    });

    const records = [
      ...financialAccountLedgerEntries,
      ...interestLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];
    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, context);
    }

    const allowedUnbalancedBusinesses = new Set<string>();
    const mainLedgerEntry = financialAccountLedgerEntries[0];
    if (!mainLedgerEntry.isCreditorCounterparty) {
      allowedUnbalancedBusinesses.add(mainLedgerEntry.debitAccountID1);
    }
    if (mainBusinessId && isBreathingDeposit) {
      allowedUnbalancedBusinesses.add(mainBusinessId);
    }
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );
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
