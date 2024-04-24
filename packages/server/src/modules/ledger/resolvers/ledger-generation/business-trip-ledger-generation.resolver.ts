import { Injector } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { BusinessTripTransactionsProvider } from '@modules/business-trips/providers/business-trips-transactions.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import {
  generatePartialLedgerEntry,
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForBusinessTrip: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  const errors: Set<string> = new Set();

  if (!charge.tax_category_id) {
    errors.add(`Business trip is missing tax category`);
  }
  const tripTaxCategory = charge.tax_category_id;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    // Get all transactions and business trip transactions
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const businessTripTransactionsPromise = injector
      .get(BusinessTripTransactionsProvider)
      .getBusinessTripsTransactionsByChargeIdLoader.load(chargeId);
    const businessTripAttendeesPromise = injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByChargeIdLoader.load(chargeId);
    const [transactions, businessTripTransactions, businessTripAttendees] = await Promise.all([
      transactionsPromise,
      businessTripTransactionsPromise,
      businessTripAttendeesPromise,
    ]);

    // generate ledger from transactions
    let entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];

    // generate ledger from transactions
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    // for each transaction, create a ledger record
    const mainTransactionsPromises = mainTransactions.map(async preValidatedTransaction => {
      try {
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

        // get tax category
        const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

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
        const ledgerEntry: StrictLedgerProto = {
          ...partialEntry,
          creditAccountID1: partialEntry.isCreditorCounterparty
            ? transaction.business_id
            : accountTaxCategoryId,
          debitAccountID1: partialEntry.isCreditorCounterparty
            ? accountTaxCategoryId
            : transaction.business_id,
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    });

    // create a ledger record for fee transactions
    const feeTransactionsPromises = feeTransactions.map(async transaction =>
      getEntriesFromFeeTransaction(transaction, charge, injector)
        .then(entries => {
          entries.map(entry => {
            feeFinancialAccountLedgerEntries.push(entry);
            updateLedgerBalanceByEntry(entry, ledgerBalance);
          });
        })
        .catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        }),
    );

    entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    await Promise.all(entriesPromises);

    // generate ledger from business trip transactions
    entriesPromises = [];
    const businessTripTransactionsPromises = businessTripTransactions.map(
      async businessTripTransaction => {
        if (!tripTaxCategory) {
          return;
        }

        const isTransactionBased = !!businessTripTransaction.transaction_id;
        if (isTransactionBased) {
          const matchingEntry = financialAccountLedgerEntries.find(
            entry => entry.id === businessTripTransaction.transaction_id,
          );
          if (!matchingEntry) {
            errors.add(
              `Flight transaction ID="${businessTripTransaction.transaction_id}" is missing from transactions`,
            );
            return;
          }

          const isCreditorCounterparty = !matchingEntry.isCreditorCounterparty;
          const businessId = isCreditorCounterparty
            ? matchingEntry.debitAccountID1
            : matchingEntry.creditAccountID1;
          const ledgerEntry: StrictLedgerProto = {
            ...matchingEntry,
            id: businessTripTransaction.id!,
            isCreditorCounterparty,
            creditAccountID1: isCreditorCounterparty ? businessId : tripTaxCategory,
            debitAccountID1: isCreditorCounterparty ? tripTaxCategory : businessId,
          };

          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        } else {
          if (
            !businessTripTransaction.employee_business_id ||
            !businessTripTransaction.date ||
            !businessTripTransaction.amount ||
            !businessTripTransaction.currency
          ) {
            errors.add(
              `Business trip flight transaction ID="${businessTripTransaction.id}" is missing required fields`,
            );
            return;
          }

          // preparations for core ledger entries
          let exchangeRate: number | undefined = undefined;
          if (businessTripTransaction.currency !== DEFAULT_LOCAL_CURRENCY) {
            // get exchange rate for currency
            exchangeRate = await injector
              .get(ExchangeProvider)
              .getExchangeRates(
                businessTripTransaction.currency as Currency,
                DEFAULT_LOCAL_CURRENCY,
                businessTripTransaction.date,
              );
          }

          // set amounts
          let amount = Number(businessTripTransaction.amount);
          let foreignAmount: number | undefined = undefined;
          if (exchangeRate) {
            foreignAmount = amount;
            // calculate amounts in ILS
            amount = exchangeRate * amount;
          }
          const absAmount = Math.abs(amount);
          const absForeignAmount = foreignAmount ? Math.abs(foreignAmount) : undefined;

          const isCreditorCounterparty = amount > 0;
          const ledgerEntry: StrictLedgerProto = {
            id: businessTripTransaction.id!,
            invoiceDate: businessTripTransaction.date,
            valueDate: businessTripTransaction.date,
            currency: businessTripTransaction.currency as Currency,
            creditAccountID1: isCreditorCounterparty
              ? businessTripTransaction.employee_business_id
              : tripTaxCategory,
            creditAmount1: absForeignAmount,
            localCurrencyCreditAmount1: absAmount,
            debitAccountID1: isCreditorCounterparty
              ? tripTaxCategory
              : businessTripTransaction.employee_business_id,
            debitAmount1: absForeignAmount,
            localCurrencyDebitAmount1: absAmount,
            reference1: businessTripTransaction.id!,
            isCreditorCounterparty,
            ownerId: charge.owner_id,
            currencyRate: exchangeRate,
            chargeId: charge.id,
          };

          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        }
      },
    );

    entriesPromises = businessTripTransactionsPromises;
    await Promise.all(entriesPromises);

    const allowedUnbalancedBusinesses = new Set(businessTripAttendees.map(attendee => attendee.id));

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      allowedUnbalancedBusinesses,
    );

    const records = [...financialAccountLedgerEntries, ...feeFinancialAccountLedgerEntries];
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
