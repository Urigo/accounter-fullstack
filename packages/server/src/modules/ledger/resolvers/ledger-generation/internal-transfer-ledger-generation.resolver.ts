import { Injector } from 'graphql-modules';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_TAX_CATEGORY_ID,
  FEE_TAX_CATEGORY_ID,
} from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  isSupplementalFeeTransaction,
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
  object
> = async (charge, _, { injector }) => {
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
        const isSupplementalFee = isSupplementalFeeTransaction(transaction);
        const { currency, valueDate, transactionBusinessId } =
          validateTransactionBasicVariables(transaction);

        let amount = Number(transaction.amount);
        if (amount === 0) {
          return;
        }
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

          const ledgerEntry: StrictLedgerProto = {
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
          };

          feeFinancialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        } else {
          const businessTaxCategory = await injector
            .get(TaxCategoriesProvider)
            .taxCategoryByBusinessAndOwnerIDsLoader.load({
              businessId: transactionBusinessId,
              ownerId: charge.owner_id,
            });
          if (!businessTaxCategory) {
            throw new LedgerError(`Business ID="${transactionBusinessId}" is missing tax category`);
          }

          const ledgerEntry: LedgerProto = {
            id: transaction.id,
            invoiceDate: transaction.event_date,
            valueDate,
            currency,
            creditAccountID1: isCreditorCounterparty ? businessTaxCategory.id : undefined,
            creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
            localCurrencyCreditAmount1: Math.abs(amount),
            debitAccountID1: isCreditorCounterparty ? undefined : businessTaxCategory.id,
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
          dates.add(valueDate.getTime());
          currencies.add(currency);
        }
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
          currency: destinationEntry.currency, // NOTE: this field is dummy
          ownerId: destinationEntry.ownerId,
          chargeId,
        };

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }
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
      errors: Array.from(errors),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
