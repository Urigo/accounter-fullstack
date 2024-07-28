import { Injector } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { BusinessTripTransactionsProvider } from '@modules/business-trips/providers/business-trips-transactions.provider.js';
import { currency } from '@modules/charges/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { ledgerEntryFromDocument } from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  DEFAULT_TAX_CATEGORY,
  INCOME_EXCHANGE_RATE_TAX_CATEGORY_ID,
} from '@shared/constants';
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
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, { injector }) => {
  const chargeId = charge.id;

  const errors: Set<string> = new Set();

  if (!charge.tax_category_id) {
    errors.add(`Business trip is missing tax category`);
  }
  const tripTaxCategory = charge.tax_category_id;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();

    const gotRelevantDocuments =
      Number(charge.invoices_count ?? 0) + Number(charge.receipts_count ?? 0) > 0;

    // Get all transactions and business trip transactions
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const documentsPromise = gotRelevantDocuments
      ? injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId)
      : Promise.resolve([]);
    const documentsTaxCategoryIdPromise = new Promise<string | undefined>((resolve, reject) => {
      if (charge.tax_category_id) {
        resolve(charge.tax_category_id);
      }
      if (!gotRelevantDocuments) {
        resolve(undefined);
      }
      return injector
        .get(TaxCategoriesProvider)
        .taxCategoryByChargeIDsLoader.load(charge.id)
        .then(res => res?.id)
        .then(res => {
          if (res) {
            resolve(res);
          } else {
            errors.add('Tax category not found');
            resolve(DEFAULT_TAX_CATEGORY);
          }
        })
        .catch(reject);
    });
    const businessTripTransactionsPromise = injector
      .get(BusinessTripTransactionsProvider)
      .getBusinessTripsTransactionsByChargeIdLoader.load(chargeId);
    const businessTripAttendeesPromise = injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByChargeIdLoader.load(chargeId);
    const [
      transactions,
      documents,
      documentsTaxCategoryId,
      businessTripTransactions,
      businessTripAttendees,
    ] = await Promise.all([
      transactionsPromise,
      documentsPromise,
      documentsTaxCategoryIdPromise,
      businessTripTransactionsPromise,
      businessTripAttendeesPromise,
    ]);

    // generate ledger from transactions
    const entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const accountingLedgerEntries: LedgerProto[] = [];

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    // generate ledger from transactions
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    let isSelfClosingLedger = mainTransactions.length === 1;
    let transactionsTotalLocalAmount = 0;

    // for each transaction, create a ledger record
    const mainTransactionsPromises = mainTransactions.map(async preValidatedTransaction => {
      try {
        const transaction = validateTransactionRequiredVariables(preValidatedTransaction, {
          skipBusinessId: isSelfClosingLedger,
        });
        if (transaction.business_id) {
          isSelfClosingLedger = false;
        }

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

        transactionsTotalLocalAmount +=
          (partialEntry.isCreditorCounterparty ? 1 : -1) * partialEntry.localCurrencyCreditAmount1;

        isSelfClosingLedger &&= partialEntry.localCurrencyCreditAmount1 < 300;
        const entryBusinessId =
          (isSelfClosingLedger ? tripTaxCategory : null) ?? transaction.business_id;
        if (!entryBusinessId) {
          throw new LedgerError(
            `Transaction reference "${transaction.source_reference}" is missing business ID`,
          );
        }

        const ledgerEntry: StrictLedgerProto = {
          ...partialEntry,
          creditAccountID1: partialEntry.isCreditorCounterparty
            ? entryBusinessId
            : accountTaxCategoryId,
          debitAccountID1: partialEntry.isCreditorCounterparty
            ? accountTaxCategoryId
            : entryBusinessId,
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(ledgerEntry.valueDate.getTime());
        currencies.add(ledgerEntry.currency);
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
            dates.add(entry.valueDate.getTime());
            currencies.add(entry.currency);
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

    // generate ledger from documents
    if (gotRelevantDocuments) {
      // Get all relevant documents for charge
      const relevantDocuments = documents.filter(d =>
        ['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE'].includes(d.type),
      );

      // if no relevant documents found and business can settle with receipts, look for receipts
      if (!relevantDocuments.length && charge.can_settle_with_receipt) {
        relevantDocuments.push(...documents.filter(d => d.type === 'RECEIPT'));
      }

      // for each invoice - generate accounting ledger entry
      const documentsEntriesPromises = relevantDocuments.map(async document => {
        if (!documentsTaxCategoryId) {
          return;
        }

        return ledgerEntryFromDocument(
          document,
          injector,
          chargeId,
          charge.owner_id,
          documentsTaxCategoryId!,
        )
          .then(ledgerEntry => {
            accountingLedgerEntries.push(ledgerEntry);
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
            dates.add(ledgerEntry.valueDate.getTime());
            currencies.add(ledgerEntry.currency);
          })
          .catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          });
      });

      entriesPromises.push(...documentsEntriesPromises);
    }

    entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    await Promise.all(entriesPromises);

    if (Math.abs(transactionsTotalLocalAmount) > 1000 && accountingLedgerEntries.length === 0) {
      errors.add(`Charge of more than 1000 ${DEFAULT_LOCAL_CURRENCY} requires a document`);
    }

    // generate ledger from business trip transactions
    if (!isSelfClosingLedger && !accountingLedgerEntries.length) {
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

      await Promise.all(businessTripTransactionsPromises);
    }

    const allowedUnbalancedBusinesses = new Set(businessTripAttendees.map(attendee => attendee.id));

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      undefined,
      allowedUnbalancedBusinesses,
    );
    // check if exchange rate record is needed
    const hasMultipleDates = dates.size > 1;
    const foreignCurrencyCount = currencies.size - (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);

    const mightRequireExchangeRateRecord =
      (hasMultipleDates && !!foreignCurrencyCount) || foreignCurrencyCount >= 2;
    const unbalancedBusinesses = ledgerBalanceInfo.unbalancedEntities.filter(({ entityId }) =>
      ledgerBalanceInfo.financialEntities.some(fe => fe.id === entityId && fe.type === 'business'),
    );

    const miscLedgerEntries: LedgerProto[] = [];

    if (mightRequireExchangeRateRecord && unbalancedBusinesses.length === 1) {
      const transactionEntry = financialAccountLedgerEntries[0];
      const documentEntry = accountingLedgerEntries[0];

      const { entityId, balance } = unbalancedBusinesses[0];
      const amount = Math.abs(balance.raw);
      const isCreditorCounterparty = balance.raw < 0;

      const exchangeRateEntry = accountingLedgerEntries.find(entry =>
        [entry.creditAccountID1, entry.debitAccountID1].includes(entityId),
      );

      let exchangeRateTaxCategory: string | undefined = undefined;
      if (exchangeRateEntry) {
        exchangeRateTaxCategory =
          exchangeRateEntry.debitAccountID1 === entityId
            ? exchangeRateEntry.creditAccountID1
            : exchangeRateEntry.debitAccountID1;

        const isIncomeCharge = charge.event_amount && Number(charge.event_amount) > 0;
        if (isIncomeCharge) {
          exchangeRateTaxCategory = INCOME_EXCHANGE_RATE_TAX_CATEGORY_ID;
        }
      }

      if (exchangeRateTaxCategory) {
        const ledgerEntry: StrictLedgerProto = {
          id: transactionEntry.id + '|fee', // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? entityId : exchangeRateTaxCategory,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? exchangeRateTaxCategory : entityId,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: documentEntry.invoiceDate,
          valueDate: transactionEntry.valueDate,
          currency: DEFAULT_LOCAL_CURRENCY,
          ownerId: transactionEntry.ownerId,
          chargeId,
        };
        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      } else {
        errors.add(`Failed to locate tax category for exchange rate for business ID="${entityId}"`);
      }
    }

    const records = [
      ...financialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...accountingLedgerEntries,
      ...miscLedgerEntries,
    ];

    const updatedLedgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      errors,
      allowedUnbalancedBusinesses,
    );

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, records, injector);
    }

    return {
      records: ledgerProtoToRecordsConverter(records),
      charge,
      balance: updatedLedgerBalanceInfo,
      errors: Array.from(errors),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
