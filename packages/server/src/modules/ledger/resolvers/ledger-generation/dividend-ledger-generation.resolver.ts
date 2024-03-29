import { GraphQLError } from 'graphql';
import { DividendsProvider } from '@modules/dividends/providers/dividends.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  DIVIDEND_TAX_CATEGORY_ID,
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
  DIVIDEND_WITHHOLDING_TAX_PERCENTAGE,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { splitDividendTransactions } from '../../helpers/dividend-ledger.helper.js';
import { getEntriesFromFeeTransaction } from '../../helpers/fee-transactions.js';
import {
  generatePartialLedgerEntry,
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForDividend: ResolverFn<
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

    // generate ledger from transactions
    const paymentsLedgerEntries: LedgerProto[] = [];
    const withholdingTaxLedgerEntries: LedgerProto[] = [];
    let mainAccountId: string | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { withholdingTaxTransactions, paymentsTransactions, feeTransactions } =
      splitDividendTransactions(transactions);

    // create a ledger record for tax deduction origin
    for (const preValidatedTransaction of withholdingTaxTransactions) {
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
      if (transaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        throw new GraphQLError(
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
        throw new GraphQLError(`Tax category is not consistent`);
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
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    const dividendRecords = await injector
      .get(DividendsProvider)
      .getDividendsByChargeIdLoader.load(chargeId);

    const totalDividendSumMap = new Map<number, number>();
    const allowedUnbalancedBusinesses = new Set<string>();

    // create a ledger record for dividend payments
    for (const preValidatedTransaction of paymentsTransactions) {
      const dividendRecord = dividendRecords.find(
        record => record.transaction_id === preValidatedTransaction.id,
      );

      // run validations
      if (!dividendRecord) {
        throw new GraphQLError(
          `Transaction ID="${preValidatedTransaction.id}" is missing matching dividend record`,
        );
      }
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
      if (Number(transaction.amount) >= 0) {
        throw new GraphQLError(
          `Dividend transaction amount cannot be positive (ID: ${transaction.id})`,
        );
      }
      if (Number(dividendRecord.amount) <= 0) {
        throw new GraphQLError(`Dividend amount is not positive (ID: ${dividendRecord.id})`);
      }
      if (
        charge.owner_id !== dividendRecord.owner_id ||
        transaction.debit_date.getTime() !== dividendRecord.date.getTime()
      ) {
        throw new GraphQLError(
          `Transaction ID="${transaction.id}" is not matching dividend record ID="${dividendRecord.id}"`,
        );
      }

      const withholdingTaxPercentage = dividendRecord.withholding_tax_percentage_override
        ? Number(dividendRecord.withholding_tax_percentage_override)
        : DIVIDEND_WITHHOLDING_TAX_PERCENTAGE;

      // generate closing ledger entry out of the dividend record
      const dividendRecordAbsAmount = Math.abs(Number(dividendRecord.amount));
      const closingEntry: LedgerProto = {
        id: dividendRecord.id,
        invoiceDate: dividendRecord.date,
        valueDate: dividendRecord.date,
        currency: DEFAULT_LOCAL_CURRENCY,
        isCreditorCounterparty: true,
        ownerId: dividendRecord.owner_id,
        creditAccountID1: dividendRecord.business_id,
        localCurrencyCreditAmount1: dividendRecordAbsAmount,
        localCurrencyDebitAmount1: dividendRecordAbsAmount,
        chargeId,
      };

      paymentsLedgerEntries.push(closingEntry);
      updateLedgerBalanceByEntry(closingEntry, ledgerBalance);
      totalDividendSumMap.set(
        dividendRecord.date.getTime(),
        (totalDividendSumMap.get(dividendRecord.date.getTime()) ?? 0) + dividendRecordAbsAmount,
      );

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

      const isForeignCurrency = partialEntry.currency !== DEFAULT_LOCAL_CURRENCY;
      const amountDiff =
        partialEntry.localCurrencyCreditAmount1 -
        Number(dividendRecord.amount) * (1 - withholdingTaxPercentage);
      if (Math.abs(amountDiff) > 0.005) {
        if (isForeignCurrency) {
          allowedUnbalancedBusinesses.add(transaction.business_id);
        } else {
          throw new GraphQLError(
            `Transaction ID="${transaction.id}" and dividend record ID="${dividendRecord.id}" amounts mismatch`,
          );
        }
      }

      // generate core ledger entries
      let foreignAccountTaxCategoryId: string | undefined = undefined;
      if (isForeignCurrency) {
        foreignAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

        const coreLedgerEntry: LedgerProto = {
          id: dividendRecord.id,
          invoiceDate: dividendRecord.date,
          valueDate: dividendRecord.date,
          currency: DEFAULT_LOCAL_CURRENCY,
          description: 'נ20',
          isCreditorCounterparty: false,
          ownerId: dividendRecord.owner_id,
          debitAccountID1: dividendRecord.business_id,
          localCurrencyDebitAmount1: dividendRecordAbsAmount,
          creditAccountID1: mainAccountId,
          localCurrencyCreditAmount1: dividendRecordAbsAmount * (1 - withholdingTaxPercentage),
          creditAccountID2: DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
          localCurrencyCreditAmount2: dividendRecordAbsAmount * withholdingTaxPercentage,
          chargeId,
        };

        paymentsLedgerEntries.push(coreLedgerEntry);
        updateLedgerBalanceByEntry(coreLedgerEntry, ledgerBalance);

        // create conversion ledger entries
        const conversionEntry1: LedgerProto = {
          ...partialEntry,
          isCreditorCounterparty: false,
          creditAccountID1: foreignAccountTaxCategoryId,
          debitAccountID1: transaction.business_id,
        };

        paymentsLedgerEntries.push(conversionEntry1);
        updateLedgerBalanceByEntry(conversionEntry1, ledgerBalance);

        const conversionEntry2: LedgerProto = {
          id: dividendRecord.id,
          invoiceDate: dividendRecord.date,
          valueDate: dividendRecord.date,
          description: 'Conversion entry',
          isCreditorCounterparty: true,
          ownerId: dividendRecord.owner_id,
          currency: DEFAULT_LOCAL_CURRENCY,
          creditAccountID1: dividendRecord.business_id,
          localCurrencyCreditAmount1: dividendRecordAbsAmount * (1 - withholdingTaxPercentage),
          debitAccountID1: mainAccountId,
          localCurrencyDebitAmount1: dividendRecordAbsAmount * (1 - withholdingTaxPercentage),
          chargeId,
        };

        paymentsLedgerEntries.push(conversionEntry2);
        updateLedgerBalanceByEntry(conversionEntry2, ledgerBalance);
      } else {
        const coreLedgerEntry: LedgerProto = {
          ...partialEntry,
          isCreditorCounterparty: false,
          description: 'נ20',
          debitAccountID1: transaction.business_id,
          localCurrencyDebitAmount1: dividendRecordAbsAmount,
          creditAccountID1: mainAccountId,
          localCurrencyCreditAmount1: dividendRecordAbsAmount * (1 - withholdingTaxPercentage),
          creditAccountID2: DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
          localCurrencyCreditAmount2: dividendRecordAbsAmount * withholdingTaxPercentage,
        };

        paymentsLedgerEntries.push(coreLedgerEntry);
        updateLedgerBalanceByEntry(coreLedgerEntry, ledgerBalance);
      }
    }

    // create a ledger record for fee transactions
    const entriesPromises: Array<Promise<void>> = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      await getEntriesFromFeeTransaction(transaction, charge, context).then(ledgerEntries => {
        feeFinancialAccountLedgerEntries.push(...ledgerEntries);
        ledgerEntries.map(ledgerEntry => {
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        });
      });
    });

    entriesPromises.push(...feeTransactionsPromises);
    await Promise.all(entriesPromises);

    // create ledger entry for summary dividend tax category
    for (const [date, sum] of totalDividendSumMap.entries()) {
      const ledgerEntry: LedgerProto = {
        id: chargeId,
        invoiceDate: new Date(date),
        valueDate: new Date(date),
        isCreditorCounterparty: false,
        ownerId: charge.owner_id,
        currency: DEFAULT_LOCAL_CURRENCY,
        localCurrencyCreditAmount1: sum,
        debitAccountID1: DIVIDEND_TAX_CATEGORY_ID,
        localCurrencyDebitAmount1: sum,
        chargeId,
      };

      paymentsLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      allowedUnbalancedBusinesses,
    );

    const records = [
      ...withholdingTaxLedgerEntries,
      ...paymentsLedgerEntries,
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
