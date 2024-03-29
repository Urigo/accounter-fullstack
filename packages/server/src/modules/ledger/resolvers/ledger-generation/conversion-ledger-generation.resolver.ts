import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY, FEE_TAX_CATEGORY_ID } from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import { conversionFeeCalculator } from '../../helpers/conversion-charge-ledger.helper.js';
import {
  isSupplementalFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  isTransactionsOppositeSign,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForConversion: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    let baseEntry: LedgerProto | undefined = undefined;
    let quoteEntry: LedgerProto | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    if (mainTransactions.length !== 2) {
      throw new GraphQLError(`Conversion Charge must include two main transactions`);
    }

    if (!isTransactionsOppositeSign(mainTransactions)) {
      throw new GraphQLError(
        `Conversion Charge must include two main transactions with opposite sign`,
      );
    }

    // for each transaction, create a ledger record
    for (const transaction of mainTransactions) {
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

      const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(
        injector,
        transaction,
        currency,
      );

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: LedgerProto = {
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        ...(isCreditorCounterparty
          ? {
              debitAccountID1: accountTaxCategoryId,
            }
          : {
              creditAccountID1: accountTaxCategoryId,
            }),
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId,
      };

      if (amount < 0) {
        baseEntry = ledgerEntry;
      } else if (amount > 0) {
        quoteEntry = ledgerEntry;
      }

      mainFinancialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    if (!baseEntry || !quoteEntry) {
      throw new GraphQLError(`Conversion Charge must include two main transactions`);
    }

    // create a ledger record for fee transactions
    for (const transaction of feeTransactions) {
      if (!transaction.is_fee) {
        continue;
      }

      const isSupplementalFee = isSupplementalFeeTransaction(transaction);
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);

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

      const isCreditorCounterparty = amount > 0;

      if (isSupplementalFee) {
        const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
          injector,
          transaction,
          currency,
        );

        feeFinancialAccountLedgerEntries.push({
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty
            ? FEE_TAX_CATEGORY_ID
            : financialAccountTaxCategoryId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty
            ? financialAccountTaxCategoryId
            : FEE_TAX_CATEGORY_ID,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        });
      } else {
        const businessTaxCategory = quoteEntry.debitAccountID1!;
        if (!businessTaxCategory) {
          throw new GraphQLError(
            `Quote ledger entry for charge ID=${chargeId} is missing Tax category`,
          );
        }

        const ledgerEntry: StrictLedgerProto = {
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty ? FEE_TAX_CATEGORY_ID : transactionBusinessId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? transactionBusinessId : FEE_TAX_CATEGORY_ID,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty: !isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        feeFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }
    }

    const miscLedgerEntries: LedgerProto[] = [];

    // calculate conversion fee
    const [quoteRate, baseRate] = await Promise.all(
      [quoteEntry.currency, baseEntry.currency].map(currency =>
        injector
          .get(ExchangeProvider)
          .getExchangeRates(currency as Currency, DEFAULT_LOCAL_CURRENCY, baseEntry!.valueDate),
      ),
    );
    const toLocalRate = quoteRate;
    const directRate = quoteRate / baseRate;
    const conversionFee = conversionFeeCalculator(baseEntry, quoteEntry, directRate, toLocalRate);

    if (conversionFee.localAmount !== 0) {
      const isDebitConversion = conversionFee.localAmount >= 0;

      const ledgerEntry: LedgerProto = {
        id: quoteEntry.id + '|fee', // NOTE: this field is dummy
        creditAccountID1: isDebitConversion ? FEE_TAX_CATEGORY_ID : undefined,
        creditAmount1: conversionFee.foreignAmount
          ? Math.abs(conversionFee.foreignAmount)
          : undefined,
        localCurrencyCreditAmount1: Math.abs(conversionFee.localAmount),
        debitAccountID1: isDebitConversion ? undefined : FEE_TAX_CATEGORY_ID,
        debitAmount1: conversionFee.foreignAmount
          ? Math.abs(conversionFee.foreignAmount)
          : undefined,
        localCurrencyDebitAmount1: Math.abs(conversionFee.localAmount),
        description: 'Conversion fee',
        isCreditorCounterparty: true,
        invoiceDate: quoteEntry.invoiceDate,
        valueDate: quoteEntry.valueDate,
        currency: quoteEntry.currency,
        reference1: quoteEntry.reference1,
        ownerId: quoteEntry.ownerId,
        chargeId,
      };

      miscLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(injector, ledgerBalance);

    const records = [
      ...mainFinancialAccountLedgerEntries,
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
