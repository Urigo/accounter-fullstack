import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { ledgerEntryFromMainTransaction } from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { calculateExchangeRate } from '@modules/ledger/helpers/exchange-ledger.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { BankDepositTransactionsProvider } from '@modules/transactions/providers/bank-deposit-transactions.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_LOCAL_CURRENCY, EXCHANGE_RATE_TAX_CATEGORY_ID } from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
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

export const generateLedgerRecordsForBankDeposit: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  const chargeId = charge.id;
  const { injector } = context;

  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);

    const bankDepositTransactionsPromise = injector
      .get(BankDepositTransactionsProvider)
      .getDepositTransactionsByChargeId(chargeId);

    const [transactions, bankDepositTransactions] = await Promise.all([
      transactionsPromise,
      bankDepositTransactionsPromise,
    ]);

    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const interestLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];

    let isWithdrawal = false;

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
        injector,
        chargeId,
        charge.owner_id,
        charge.business_id ?? undefined,
      )
        .then(ledgerEntry => {
          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
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

      if (currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, valueDate);

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
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId,
      };

      interestLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    entriesPromises.push(mainTransactionPromise(), ...interestTransactionsPromises);

    await Promise.all(entriesPromises);

    const miscLedgerEntries: StrictLedgerProto[] = [];

    const miscLedgerEntriesPromise = async () => {
      // handle exchange rates
      if (isWithdrawal) {
        const mainLedgerEntry = financialAccountLedgerEntries[0];
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

        const depositTransaction = depositTransactions[0];

        if (
          mainTransaction.amount.replace('-', '') !== depositTransaction.amount.replace('-', '') ||
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
            convertLedgerRecordToProto(depositLedgerRecord),
            ledgerBalance,
          );
        }
        if (mainTransaction.currency !== DEFAULT_LOCAL_CURRENCY) {
          const rawAmount =
            Number(depositLedgerRecord.credit_local_amount1) -
            mainLedgerEntry.localCurrencyCreditAmount1;
          const amount = Math.abs(rawAmount);
          const isCreditorCounterparty = rawAmount > 0;
          const mainAccountId = mainLedgerEntry.creditAccountID1;

          // validate exchange rate
          try {
            const exchangeAmount = calculateExchangeRate(mainLedgerEntry.creditAccountID1, [
              ...financialAccountLedgerEntries,
              convertLedgerRecordToProto(depositLedgerRecord),
            ]);
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
            creditAccountID1: isCreditorCounterparty
              ? mainAccountId
              : EXCHANGE_RATE_TAX_CATEGORY_ID,
            localCurrencyCreditAmount1: amount,
            debitAccountID1: isCreditorCounterparty ? EXCHANGE_RATE_TAX_CATEGORY_ID : mainAccountId,
            localCurrencyDebitAmount1: amount,
            description: 'Exchange ledger record',
            isCreditorCounterparty,
            invoiceDate: mainLedgerEntry.valueDate,
            valueDate: mainLedgerEntry.valueDate,
            currency: DEFAULT_LOCAL_CURRENCY,
            ownerId: mainLedgerEntry.ownerId,
            chargeId,
          };
          miscLedgerEntries.push(exchangeLedgerEntry);
          updateLedgerBalanceByEntry(exchangeLedgerEntry, ledgerBalance);
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
      await storeInitialGeneratedRecords(charge, records, injector);
    }

    const allowedUnbalancedBusinesses = new Set<string>();
    const mainLedgerEntry = financialAccountLedgerEntries[0];
    if (!mainLedgerEntry.isCreditorCounterparty) {
      allowedUnbalancedBusinesses.add(mainLedgerEntry.debitAccountID1);
    }
    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
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
