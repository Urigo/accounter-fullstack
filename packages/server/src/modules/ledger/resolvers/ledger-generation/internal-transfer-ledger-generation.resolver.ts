import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import { DEFAULT_LOCAL_CURRENCY, EXCHANGE_RATE_TAX_CATEGORY_ID } from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  isTransactionsOppositeSign,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForInternalTransfer: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, { injector }) => {
  const chargeId = charge.id;

  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    let originEntry: LedgerProto | undefined = undefined;
    let destinationEntry: LedgerProto | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    if (mainTransactions.length !== 2) {
      errors.add(`Internal transfer Charge must include two main transactions`);
    }

    try {
      if (!isTransactionsOppositeSign(mainTransactions)) {
        errors.add(
          `Internal transfer Charge must include two main transactions with opposite sign`,
        );
      }
    } catch (e) {
      if (e instanceof LedgerError) {
        errors.add(e.message);
      } else {
        throw e;
      }
    }

    // create a ledger record for main transactions
    const mainFinancialAccountLedgerEntriesPromises = mainTransactions.map(async transaction => {
      try {
        const { currency, valueDate } = validateTransactionBasicVariables(transaction);

        let amount = Number(transaction.amount);
        let foreignAmount: number | undefined = undefined;

        if (currency !== DEFAULT_LOCAL_CURRENCY) {
          // get exchange rate for currency
          const exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, valueDate);

          foreignAmount = amount;
          // calculate amounts in ILS
          amount = exchangeRate * amount;
        }

        const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
          injector,
          transaction,
        );

        const isCreditorCounterparty = amount > 0;

        const ledgerEntry: LedgerProto = {
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          ...(isCreditorCounterparty
            ? {
                debitAccountID1: financialAccountTaxCategoryId,
              }
            : {
                creditAccountID1: financialAccountTaxCategoryId,
              }),
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        mainFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(valueDate.getTime());
        currencies.add(currency);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });

    // create a ledger record for fee transactions
    const feeFinancialAccountLedgerEntriesPromises = feeTransactions.map(async transaction => {
      if (!transaction.is_fee) {
        return;
      }

      try {
        const ledgerEntryPromise = getEntriesFromFeeTransaction(
          transaction,
          charge,
          injector,
        ).catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });

        const miscExpensesPromise = generateMiscExpensesLedger(transaction, injector);

        const [ledgerEntries, miscExpensesLedger] = await Promise.all([
          ledgerEntryPromise,
          miscExpensesPromise,
        ]);

        // add misc expenses ledger entries
        miscExpensesLedger.map(entry => {
          entry.ownerId = charge.owner_id;
          feeFinancialAccountLedgerEntries.push(entry);
          updateLedgerBalanceByEntry(entry, ledgerBalance);
          dates.add(entry.valueDate.getTime());
          currencies.add(entry.currency);
        });

        if (!ledgerEntries) {
          return;
        }

        feeFinancialAccountLedgerEntries.push(...ledgerEntries);
        ledgerEntries.map(ledgerEntry => {
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
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
    });

    await Promise.all([
      ...feeFinancialAccountLedgerEntriesPromises,
      ...mainFinancialAccountLedgerEntriesPromises,
    ]);

    for (const ledgerEntry of mainFinancialAccountLedgerEntries) {
      if (ledgerEntry.isCreditorCounterparty) {
        destinationEntry = ledgerEntry;
      } else {
        originEntry = ledgerEntry;
      }
    }

    const { balanceSum } = await getLedgerBalanceInfo(injector, ledgerBalance);
    const miscLedgerEntries: LedgerProto[] = [];

    if (!originEntry || !destinationEntry) {
      errors.add(`Internal transfer Charge must include two main transactions`);
    } else if (Math.abs(balanceSum) > 0.005) {
      // Add ledger completion entries
      const hasMultipleDates = dates.size > 1;
      const hasForeignCurrency = currencies.size > (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);
      if (hasMultipleDates && hasForeignCurrency) {
        const amount = Math.abs(balanceSum);

        const isCreditorCounterparty = balanceSum > 0;

        const ledgerEntry: LedgerProto = {
          id: destinationEntry.id, // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? undefined : EXCHANGE_RATE_TAX_CATEGORY_ID,
          creditAmount1: undefined,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? EXCHANGE_RATE_TAX_CATEGORY_ID : undefined,
          debitAmount1: undefined,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: originEntry.invoiceDate,
          valueDate: destinationEntry.valueDate,
          currency: DEFAULT_LOCAL_CURRENCY,
          ownerId: destinationEntry.ownerId,
          chargeId,
        };

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(injector, ledgerBalance, errors);

    const records = [
      ...mainFinancialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, records, injector);
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
