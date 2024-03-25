import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { BankDepositTransactionsProvider } from '@modules/transactions/providers/bank-deposit-transactions.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_TAX_CATEGORY_ID,
  INTERNAL_WALLETS_IDS,
} from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import { storeInitialGeneratedRecords } from '../../helpers/ledgrer-storage.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForBankDeposit: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (charge, _, context) => {
  const chargeId = charge.id;
  const { injector } = context;

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

    const mainTransactionPromise = async () => {
      // for each transaction, create a ledger record
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(mainTransaction);

      let mainAccountId: string = transactionBusinessId;

      if (
        mainTransaction.source_reference &&
        charge.business_id &&
        INTERNAL_WALLETS_IDS.includes(charge.business_id)
      ) {
        mainAccountId = await getFinancialAccountTaxCategoryId(
          injector,
          mainTransaction,
          currency,
          true,
        );
      }

      let amount = Number(mainTransaction.amount);
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

      const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(
        injector,
        mainTransaction,
        currency,
      );

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: StrictLedgerProto = {
        id: mainTransaction.id,
        invoiceDate: mainTransaction.event_date,
        valueDate,
        currency,
        creditAccountID1: isCreditorCounterparty ? mainAccountId : accountTaxCategoryId,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? accountTaxCategoryId : mainAccountId,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: mainTransaction.source_description ?? undefined,
        reference1: mainTransaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: mainTransaction.currency_rate
          ? Number(mainTransaction.currency_rate)
          : undefined,
        chargeId,
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    };

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
        throw new GraphQLError(`Business ID="${transactionBusinessId}" is missing tax category`);
      }

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

      const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(
        injector,
        transaction,
        currency,
      );

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

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    entriesPromises.push(mainTransactionPromise(), ...interestTransactionsPromises);

    await Promise.all(entriesPromises);

    const miscLedgerEntries: StrictLedgerProto[] = [];

    const miscLedgerEntriesPromise = async () => {
      // handle exchange rates
      if (isWithdrawal && mainTransaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        const mainLedgerEntry = financialAccountLedgerEntries[0];
        if (!mainLedgerEntry) {
          throw new GraphQLError('Main ledger entry not found');
        }

        const depositTransactions = bankDepositTransactions.filter(t => Number(t.amount) < 0);
        if (depositTransactions.length !== 1) {
          if (depositTransactions.length === 0) {
            throw new GraphQLError('Deposit transaction not found');
          }
          throw new GraphQLError('Multiple deposit transactions found');
        }

        const depositTransaction = depositTransactions[0];

        if (
          mainTransaction.amount.replace('-', '') !== depositTransaction.amount.replace('-', '') ||
          mainTransaction.currency !== depositTransaction.currency
        ) {
          throw new GraphQLError('Deposit transaction does not match the withdrawal transaction');
        }

        const depositLedgerRecords = await injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(depositTransaction.charge_id);

        if (depositLedgerRecords.length !== 1) {
          if (depositLedgerRecords.length === 0) {
            throw new GraphQLError('Deposit ledger record not found');
          }
          throw new GraphQLError('Multiple deposit ledger records found');
        }
        const depositLedgerRecord = depositLedgerRecords[0];

        if (Number.isNaN(depositLedgerRecord.credit_local_amount1)) {
          throw new GraphQLError('Deposit ledger record has invalid local amount');
        }

        const rawAmount =
          Number(depositLedgerRecord.credit_local_amount1) -
          mainLedgerEntry.localCurrencyCreditAmount1;
        const amount = Math.abs(rawAmount);
        const isCreditorCounterparty = rawAmount > 0;
        const mainAccountId = mainLedgerEntry.creditAccountID1;

        const exchangeLedgerEntry: StrictLedgerProto = {
          id: mainTransaction.id + '|fee', // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? mainAccountId : EXCHANGE_RATE_TAX_CATEGORY_ID,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? EXCHANGE_RATE_TAX_CATEGORY_ID : mainAccountId,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: depositLedgerRecord.invoice_date,
          valueDate: mainLedgerEntry.valueDate,
          currency: mainLedgerEntry.currency, // NOTE: this field is dummy
          ownerId: mainLedgerEntry.ownerId,
          chargeId,
        };
        miscLedgerEntries.push(exchangeLedgerEntry);
        updateLedgerBalanceByEntry(exchangeLedgerEntry, ledgerBalance);
      }

      return;
    };

    await miscLedgerEntriesPromise();

    const records = [
      ...financialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];
    await storeInitialGeneratedRecords(charge, records, injector);

    const ledgerBalanceInfo = await getLedgerBalanceInfo(injector, ledgerBalance);
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
