import { Injector } from 'graphql-modules';
import { validateTransactionAgainstBusinessTrips } from '@modules/business-trips/helpers/business-trips-expenses.helper.js';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { BusinessTripEmployeePaymentsProvider } from '@modules/business-trips/providers/business-trips-employee-payments.provider.js';
import { BusinessTripExpensesProvider } from '@modules/business-trips/providers/business-trips-expenses.provider.js';
import { currency } from '@modules/charges/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import {
  getExchangeDates,
  ledgerEntryFromDocument,
} from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { validateExchangeRate } from '@modules/ledger/helpers/exchange-ledger.helper.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { UnbalancedBusinessesProvider } from '@modules/ledger/providers/unbalanced-businesses.provider.js';
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
  multipleForeignCurrenciesBalanceEntries,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

const AMOUNT_REQUIRING_DOCUMENT = 1000;
const AMOUNT_FOR_SELF_CLOSING = 300;

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
    const ledgerBalance = new Map<
      string,
      {
        amount: number;
        entityId: string;
        foreignAmounts?: Partial<Record<Currency, { local: number; foreign: number }>>;
      }
    >();

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
    const businessTripExpensesPromise = injector
      .get(BusinessTripExpensesProvider)
      .getBusinessTripsExpensesByChargeIdLoader.load(chargeId);
    const businessTripsEmployeePaymentsPromise = injector
      .get(BusinessTripEmployeePaymentsProvider)
      .getBusinessTripEmployeePaymentsByChargeIdLoader.load(chargeId);
    const businessTripAttendeesPromise = injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByChargeIdLoader.load(chargeId);
    const unbalancedBusinessesPromise = injector
      .get(UnbalancedBusinessesProvider)
      .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);
    const [
      transactions,
      documents,
      documentsTaxCategoryId,
      businessTripExpenses,
      businessTripsEmployeePayments,
      businessTripAttendees,
      chargeUnbalancedBusinesses,
    ] = await Promise.all([
      transactionsPromise,
      documentsPromise,
      documentsTaxCategoryIdPromise,
      businessTripExpensesPromise,
      businessTripsEmployeePaymentsPromise,
      businessTripAttendeesPromise,
      unbalancedBusinessesPromise,
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

        const miscExpensesPromise = generateMiscExpensesLedger(transaction, injector);

        const validateTransactionAgainstBusinessTripsPromise =
          validateTransactionAgainstBusinessTrips(injector, transaction).catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          });

        const ledgerEntryPromise = async (): Promise<StrictLedgerProto> => {
          // get tax category
          const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(
            injector,
            transaction,
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

          const partialEntry = generatePartialLedgerEntry(
            transaction,
            charge.owner_id,
            exchangeRate,
          );

          transactionsTotalLocalAmount +=
            (partialEntry.isCreditorCounterparty ? 1 : -1) *
            partialEntry.localCurrencyCreditAmount1;

          isSelfClosingLedger &&= partialEntry.localCurrencyCreditAmount1 < AMOUNT_FOR_SELF_CLOSING;
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

          return ledgerEntry;
        };

        const [ledgerEntry, miscExpensesLedger] = await Promise.all([
          ledgerEntryPromise(),
          miscExpensesPromise,
          validateTransactionAgainstBusinessTripsPromise,
        ]);

        // add misc expenses ledger entries
        miscExpensesLedger.map(entry => {
          entry.ownerId = charge.owner_id;
          feeFinancialAccountLedgerEntries.push(entry);
          updateLedgerBalanceByEntry(entry, ledgerBalance);
          dates.add(entry.valueDate.getTime());
          currencies.add(entry.currency);
        });

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
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      const ledgerEntryPromise = getEntriesFromFeeTransaction(transaction, charge, injector).catch(
        e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        },
      );

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
    });

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

    if (
      Math.abs(transactionsTotalLocalAmount) > AMOUNT_REQUIRING_DOCUMENT &&
      accountingLedgerEntries.length === 0
    ) {
      errors.add(
        `Charge of more than ${AMOUNT_REQUIRING_DOCUMENT} ${DEFAULT_LOCAL_CURRENCY} requires a document`,
      );
    }

    // generate ledger from business trip transactions
    if (!isSelfClosingLedger && !accountingLedgerEntries.length) {
      if (businessTripsEmployeePayments.length) {
        const businessTripsEmployeePaymentsPromises = businessTripsEmployeePayments.map(
          async businessTripsEmployeePayment => {
            if (!tripTaxCategory) {
              return;
            }
            if (
              !businessTripsEmployeePayment.employee_business_id ||
              !businessTripsEmployeePayment.date ||
              !businessTripsEmployeePayment.amount ||
              !businessTripsEmployeePayment.currency
            ) {
              errors.add(
                `Business trip flight transaction ID="${businessTripsEmployeePayment.id}" is missing required fields`,
              );
              return;
            }

            // preparations for core ledger entries
            let exchangeRate: number | undefined = undefined;
            if (businessTripsEmployeePayment.currency !== DEFAULT_LOCAL_CURRENCY) {
              // get exchange rate for currency
              exchangeRate = await injector
                .get(ExchangeProvider)
                .getExchangeRates(
                  businessTripsEmployeePayment.currency as Currency,
                  DEFAULT_LOCAL_CURRENCY,
                  businessTripsEmployeePayment.date,
                );
            }

            // set amounts
            let amount = Number(businessTripsEmployeePayment.amount);
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
              id: businessTripsEmployeePayment.id!,
              invoiceDate: businessTripsEmployeePayment.date,
              valueDate: businessTripsEmployeePayment.date,
              currency: businessTripsEmployeePayment.currency as Currency,
              creditAccountID1: isCreditorCounterparty
                ? businessTripsEmployeePayment.employee_business_id
                : tripTaxCategory,
              creditAmount1: absForeignAmount,
              localCurrencyCreditAmount1: absAmount,
              debitAccountID1: isCreditorCounterparty
                ? tripTaxCategory
                : businessTripsEmployeePayment.employee_business_id,
              debitAmount1: absForeignAmount,
              localCurrencyDebitAmount1: absAmount,
              reference1: businessTripsEmployeePayment.id!,
              isCreditorCounterparty,
              ownerId: charge.owner_id,
              currencyRate: exchangeRate,
              chargeId: charge.id,
            };

            accountingLedgerEntries.push(ledgerEntry);
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
            dates.add(ledgerEntry.valueDate.getTime());
            currencies.add(ledgerEntry.currency);
          },
        );
        await Promise.all(businessTripsEmployeePaymentsPromises);
      } else {
        const businessTripExpensesPromises = businessTripExpenses.map(async businessTripExpense => {
          if (!tripTaxCategory) {
            return;
          }

          const matchingEntry = financialAccountLedgerEntries.find(entry =>
            businessTripExpense.transaction_ids?.includes(entry.id),
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
            id: businessTripExpense.id!,
            isCreditorCounterparty,
            creditAccountID1: isCreditorCounterparty ? businessId : tripTaxCategory,
            debitAccountID1: isCreditorCounterparty ? tripTaxCategory : businessId,
          };

          accountingLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        });
        await Promise.all(businessTripExpensesPromises);
      }
    }

    const allowedUnbalancedBusinesses = new Set([
      ...businessTripAttendees.map(attendee => attendee.id),
      ...chargeUnbalancedBusinesses.map(({ business_id }) => business_id),
    ]);

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
      ledgerBalance,
      undefined,
      allowedUnbalancedBusinesses,
    );

    const miscLedgerEntries: LedgerProto[] = [];

    // multiple currencies balance
    const mainBusiness = charge.business_id;
    const businessBalance = ledgerBalance.get(mainBusiness ?? '');
    if (
      mainBusiness &&
      Object.keys(businessBalance?.foreignAmounts ?? {}).length >
        (charge.invoice_payment_currency_diff ? 0 : 1)
    ) {
      const transactionEntries = financialAccountLedgerEntries.filter(entry =>
        [entry.creditAccountID1, entry.debitAccountID1].includes(mainBusiness),
      );
      const documentEntries = accountingLedgerEntries.filter(entry =>
        [entry.creditAccountID1, entry.debitAccountID1].includes(mainBusiness),
      );

      try {
        const entries = multipleForeignCurrenciesBalanceEntries(
          documentEntries,
          transactionEntries,
          charge,
          businessBalance!.foreignAmounts!,
          charge.invoice_payment_currency_diff ?? false,
        );
        for (const ledgerEntry of entries) {
          miscLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        }
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    }

    // check if exchange rate record is needed
    const hasMultipleDates = dates.size > 1;
    const foreignCurrencyCount = currencies.size - (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);

    const mightRequireExchangeRateRecord =
      (hasMultipleDates && !!foreignCurrencyCount) || foreignCurrencyCount >= 2;
    const unbalancedBusinesses = ledgerBalanceInfo.unbalancedEntities.filter(
      ({ entityId }) =>
        ledgerBalanceInfo.financialEntities.some(
          fe => fe.id === entityId && fe.type === 'business',
        ) && !chargeUnbalancedBusinesses.map(b => b.business_id).includes(entityId),
    );

    if (mightRequireExchangeRateRecord && unbalancedBusinesses.length === 1) {
      const transactionEntry = financialAccountLedgerEntries[0];

      const [invoiceDate, valueDate] = getExchangeDates(
        financialAccountLedgerEntries,
        accountingLedgerEntries,
      );

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

      // validate exchange rate
      const validation = validateExchangeRate(
        entityId,
        [
          ...financialAccountLedgerEntries,
          ...feeFinancialAccountLedgerEntries,
          ...accountingLedgerEntries,
          ...miscLedgerEntries,
        ],
        balance.raw,
      );
      if (validation === true) {
        if (exchangeRateTaxCategory) {
          const ledgerEntry: StrictLedgerProto = {
            id: transactionEntry.id + '|fee', // NOTE: this field is dummy
            creditAccountID1: isCreditorCounterparty ? entityId : exchangeRateTaxCategory,
            localCurrencyCreditAmount1: amount,
            debitAccountID1: isCreditorCounterparty ? exchangeRateTaxCategory : entityId,
            localCurrencyDebitAmount1: amount,
            description: 'Exchange ledger record',
            isCreditorCounterparty,
            invoiceDate,
            valueDate,
            currency: DEFAULT_LOCAL_CURRENCY,
            ownerId: transactionEntry.ownerId,
            chargeId,
          };
          miscLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        } else {
          errors.add(
            `Failed to locate tax category for exchange rate for business ID="${entityId}"`,
          );
        }
      } else {
        errors.add(validation);
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
