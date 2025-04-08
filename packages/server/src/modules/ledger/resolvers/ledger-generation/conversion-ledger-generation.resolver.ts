import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsNewProvider } from '@modules/transactions/providers/transactions-new.provider.js';
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
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForConversion: ResolverFn<
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
        taxCategories: { feeTaxCategoryId, exchangeRevaluationTaxCategoryId },
      },
    },
  } = context;
  const chargeId = charge.id;

  const errors: Set<string> = new Set();

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    // generate ledger from transactions
    const mainFinancialAccountLedgerEntries: LedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const miscLedgerEntries: LedgerProto[] = [];
    let baseEntry: LedgerProto | undefined = undefined;
    let quoteEntry: LedgerProto | undefined = undefined;

    // Get all transactions
    const transactions = await injector
      .get(TransactionsNewProvider)
      .transactionsByChargeIDLoader.load(chargeId);
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    if (mainTransactions.length !== 2) {
      errors.add(`Conversion Charge must include two main transactions`);
    }

    try {
      if (!isTransactionsOppositeSign(mainTransactions)) {
        errors.add(`Conversion Charge must include two main transactions with opposite sign`);
      }
    } catch (e) {
      if (e instanceof LedgerError) {
        errors.add(e.message);
      } else {
        throw e;
      }
    }

    // for each transaction, create a ledger record
    const mainTransactionsPromises = mainTransactions.map(async transaction => {
      try {
        const { currency, valueDate } = validateTransactionBasicVariables(transaction);

        let amount = Number(transaction.amount);
        let foreignAmount: number | undefined = undefined;

        if (currency !== defaultLocalCurrency) {
          // get exchange rate for currency
          const exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(currency, defaultLocalCurrency, valueDate);

          foreignAmount = amount;
          // calculate amounts in ILS
          amount = exchangeRate * amount;
        }

        const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

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
          reference: transaction.source_reference,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        mainFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });

    await Promise.all(mainTransactionsPromises);

    for (const entry of mainFinancialAccountLedgerEntries) {
      if (entry.isCreditorCounterparty) {
        quoteEntry = entry;
      } else {
        baseEntry = entry;
      }
    }

    if (!baseEntry || !quoteEntry) {
      errors.add(`Conversion Charge must include two main transactions`);
    } else {
      // create a ledger record for fee transactions
      for (const transaction of feeTransactions) {
        if (!transaction.is_fee) {
          continue;
        }

        try {
          const isSupplementalFee = isSupplementalFeeTransaction(transaction, context);
          const { currency, valueDate, transactionBusinessId } =
            validateTransactionBasicVariables(transaction);

          let amount = Number(transaction.amount);
          if (amount === 0) {
            continue;
          }
          let foreignAmount: number | undefined = undefined;

          if (currency !== defaultLocalCurrency) {
            // get exchange rate for currency
            const exchangeRate = await injector
              .get(ExchangeProvider)
              .getExchangeRates(currency, defaultLocalCurrency, valueDate);

            foreignAmount = amount;
            // calculate amounts in ILS
            amount = exchangeRate * amount;
          }

          const isCreditorCounterparty = amount > 0;

          if (isSupplementalFee) {
            const financialAccountTaxCategoryId = await getFinancialAccountTaxCategoryId(
              injector,
              transaction,
            );

            feeFinancialAccountLedgerEntries.push({
              id: transaction.id,
              invoiceDate: transaction.event_date,
              valueDate,
              currency,
              creditAccountID1: isCreditorCounterparty
                ? feeTaxCategoryId
                : financialAccountTaxCategoryId,
              creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyCreditAmount1: Math.abs(amount),
              debitAccountID1: isCreditorCounterparty
                ? financialAccountTaxCategoryId
                : feeTaxCategoryId,
              debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyDebitAmount1: Math.abs(amount),
              description: transaction.source_description ?? undefined,
              reference: transaction.source_reference,
              isCreditorCounterparty,
              ownerId: charge.owner_id,
              currencyRate: transaction.currency_rate
                ? Number(transaction.currency_rate)
                : undefined,
              chargeId,
            });
          } else {
            const businessTaxCategory = quoteEntry.debitAccountID1;
            if (!businessTaxCategory) {
              throw new LedgerError(
                `Quote ledger entry for charge ID=${chargeId} is missing Tax category`,
              );
            }

            const ledgerEntry: StrictLedgerProto = {
              id: transaction.id,
              invoiceDate: transaction.event_date,
              valueDate,
              currency,
              creditAccountID1: isCreditorCounterparty ? feeTaxCategoryId : transactionBusinessId,
              creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyCreditAmount1: Math.abs(amount),
              debitAccountID1: isCreditorCounterparty ? transactionBusinessId : feeTaxCategoryId,
              debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
              localCurrencyDebitAmount1: Math.abs(amount),
              description: transaction.source_description ?? undefined,
              reference: transaction.source_reference,
              isCreditorCounterparty: !isCreditorCounterparty,
              ownerId: charge.owner_id,
              currencyRate: transaction.currency_rate
                ? Number(transaction.currency_rate)
                : undefined,
              chargeId,
            };

            feeFinancialAccountLedgerEntries.push(ledgerEntry);
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
          }
        } catch (e) {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        }
      }

      // calculate conversion fee
      const [quoteRate, baseRate] = await Promise.all(
        [quoteEntry.currency, baseEntry.currency].map(currency =>
          injector
            .get(ExchangeProvider)
            .getExchangeRates(currency as Currency, defaultLocalCurrency, baseEntry!.valueDate),
        ),
      );
      const toLocalRate = quoteRate;
      const directRate = quoteRate / baseRate;

      try {
        const conversionFee = conversionFeeCalculator(
          baseEntry,
          quoteEntry,
          directRate,
          defaultLocalCurrency,
          toLocalRate,
        );

        if (conversionFee.localAmount !== 0) {
          const isDebitConversion = conversionFee.localAmount >= 0;

          const ledgerEntry: LedgerProto = {
            id: quoteEntry.id + '|revaluation', // NOTE: this field is dummy
            creditAccountID1: isDebitConversion ? exchangeRevaluationTaxCategoryId : undefined,
            localCurrencyCreditAmount1: Math.abs(conversionFee.localAmount),
            debitAccountID1: isDebitConversion ? undefined : exchangeRevaluationTaxCategoryId,
            localCurrencyDebitAmount1: Math.abs(conversionFee.localAmount),
            description: 'Exchange Revaluation',
            isCreditorCounterparty: true,
            invoiceDate: quoteEntry.invoiceDate,
            valueDate: quoteEntry.valueDate,
            currency: defaultLocalCurrency,
            reference: quoteEntry.reference,
            ownerId: quoteEntry.ownerId,
            chargeId,
          };

          miscLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance, context);
        }
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(context, ledgerBalance, errors);

    const records = [
      ...mainFinancialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, records, context);
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
