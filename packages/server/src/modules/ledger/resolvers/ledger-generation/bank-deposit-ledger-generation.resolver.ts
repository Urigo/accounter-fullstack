import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { ledgerEntryFromMainTransaction } from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { calculateExchangeRate } from '@modules/ledger/helpers/exchange-ledger.helper.js';
import { getEntriesFromFeeTransaction } from '@modules/ledger/helpers/fee-transactions.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import type {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  convertLedgerRecordToProto,
  storeInitialGeneratedRecords,
} from '../../helpers/ledgrer-storage.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

type AccountTransactions = {
  accountId: string;
  mainTransaction: IGetTransactionsByChargeIdsResult;
  interestTransactions: IGetTransactionsByChargeIdsResult[];
};

function classifySides(accounts: AccountTransactions[]): {
  creditor: AccountTransactions;
  debtor: AccountTransactions;
} {
  if (accounts.length !== 2) {
    throw new LedgerError('Deposit charge must have 2 counterparties');
  }
  const [account1, account2] = accounts;

  const account1Side = Number(account1.mainTransaction.amount) >= 0;
  const account2Side = Number(account2.mainTransaction.amount) >= 0;

  if (account1Side === account2Side) {
    throw new Error('Both accounts are on the same side');
  }

  return {
    debtor: account1Side ? account2 : account1,
    creditor: account1Side ? account1 : account2,
  };
}

function classifyTransactions(transactions: IGetTransactionsByChargeIdsResult[]) {
  const groups = new Map<string, IGetTransactionsByChargeIdsResult[]>();
  transactions.map(t => {
    if (!t.account_id) {
      return;
    }
    if (!groups.has(t.account_id)) {
      groups.set(t.account_id, []);
    }
    groups.get(t.account_id)!.push(t);
  });

  if (groups.size !== 2) {
    throw new LedgerError('Deposit charge must have 2 counterparties');
  }

  const accounts: AccountTransactions[] = Array.from(groups.entries()).map(
    ([accountId, transactions]) => {
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
          return Math.abs(Number(current.amount)) > Math.abs(Number(mainTransaction.amount))
            ? [current, [mainTransaction, ...interestTransactions]]
            : [mainTransaction, [current, ...interestTransactions]];
        },
        [transactions[0], []],
      );

      return {
        accountId,
        mainTransaction,
        interestTransactions,
      };
    },
  );

  return classifySides(accounts);
}

export const generateLedgerRecordsForBankDeposit: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      general: {
        taxCategories: { exchangeRateTaxCategoryId },
      },
    },
  } = context;
  const chargeId = charge.id;

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

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const interestLedgerEntries: StrictLedgerProto[] = [];

    const dates = new Set<number>();
    const currencies = new Set<Currency>();

    const transactions = await injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

    // split into origin + destination main transactions, and interest / fee transactions
    const { creditor, debtor } = classifyTransactions(transactions);

    // basic entries from main transactions (transfer between accounts)
    const mainTransactionPromises = [creditor.mainTransaction, debtor.mainTransaction].map(
      async transaction =>
        ledgerEntryFromMainTransaction(
          transaction,
          context,
          chargeId,
          charge.owner_id,
          charge.business_id ?? undefined,
        )
          .then(ledgerEntry => {
            mainFinancialAccountLedgerEntries.push(ledgerEntry);
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
            dates.add(ledgerEntry.valueDate.getTime());
            currencies.add(ledgerEntry.currency);
          })
          .catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          }),
    );

    // create a ledger record for interest transactions
    const interestTransactionsPromises = [
      ...creditor.interestTransactions,
      ...debtor.interestTransactions,
    ].map(async transaction => {
      if (transaction.is_fee) {
        // entries from fee transactions
        try {
          const ledgerEntries = await getEntriesFromFeeTransaction(
            transaction,
            charge,
            context,
          ).catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          });

          if (!ledgerEntries) {
            return;
          }

          feeFinancialAccountLedgerEntries.push(...ledgerEntries);
          ledgerEntries.map(ledgerEntry => {
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
            dates.add(ledgerEntry.valueDate.getTime());
            currencies.add(ledgerEntry.currency);
          });
        } catch (e) {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        }
      } else {
        // for each interest transaction, create a ledger record
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
          reference: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        interestLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        dates.add(ledgerEntry.valueDate.getTime());
        currencies.add(ledgerEntry.currency);
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

    const entriesPromises: Array<Promise<void>> = [
      ...mainTransactionPromises,
      ...interestTransactionsPromises,
      expensesLedgerPromise,
    ];
    await Promise.all(entriesPromises);

    // exchange rate between main transactions

    // if withdrawal - exchange rate between main transaction and deposit transaction

    const miscLedgerEntries: StrictLedgerProto[] = [];

    const miscLedgerEntriesPromise = async () => {
      // handle exchange rates
      if (isWithdrawal) {
        const mainLedgerEntry = mainFinancialAccountLedgerEntries[0];
        if (!mainLedgerEntry) {
          throw new LedgerError('Main ledger entry not found');
        }

        const depositTransactions = bankDepositTransactions.filter(t => Number(t.amount) < 0);
        if (depositTransactions.length !== 1) {
          if (depositTransactions.length === 0) {
            throw new LedgerError('Deposit transaction not found');
          }
          throw new LedgerError('Multiple deposit transactions found');
        }

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

        const depositTransaction = depositTransactions[0];
        const depositTransactionAmount = Math.abs(Number(depositTransaction.amount));

        if (
          mainBusinessAbsBalance !== depositTransactionAmount ||
          mainTransaction.currency !== depositTransaction.currency
        ) {
          throw new LedgerError('Deposit transaction does not match the withdrawal transaction');
        }

        const depositLedgerRecords = await injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(depositTransaction.charge_id);

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
                ...mainFinancialAccountLedgerEntries,
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
      ...mainFinancialAccountLedgerEntries,
      ...interestLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];
    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, records, context);
    }

    const allowedUnbalancedBusinesses = new Set<string>();
    const mainLedgerEntry = mainFinancialAccountLedgerEntries[0];
    if (!mainLedgerEntry.isCreditorCounterparty) {
      allowedUnbalancedBusinesses.add(mainLedgerEntry.debitAccountID1);
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
