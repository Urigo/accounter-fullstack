import { getDeelEmployeeId } from '@modules/deel/helpers/deel.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import {
  getExchangeDates,
  isRefundCharge,
  ledgerEntryFromBalanceCancellation,
  ledgerEntryFromDocument,
  ledgerEntryFromMainTransaction,
} from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { handleCrossYearLedgerEntries } from '@modules/ledger/helpers/cross-year-ledger.helper.js';
import { validateExchangeRate } from '@modules/ledger/helpers/exchange-ledger.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import type {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatFinancialAmount, formatStringifyAmount } from '@shared/helpers';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import { storeInitialGeneratedRecords } from '../../helpers/ledgrer-storage.helper.js';
import {
  getLedgerBalanceInfo,
  LedgerError,
  ledgerProtoToRecordsConverter,
  multipleForeignCurrenciesBalanceEntries,
  updateLedgerBalanceByEntry,
} from '../../helpers/utils.helper.js';
import { BalanceCancellationProvider } from '../../providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '../../providers/unbalanced-businesses.provider.js';

export const generateLedgerRecordsForCommonCharge: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      defaultCryptoConversionFiatCurrency,
      defaultTaxCategoryId,
      general: {
        taxCategories: { incomeExchangeRateTaxCategoryId, exchangeRateTaxCategoryId },
      },
    },
  } = context;
  const chargeId = charge.id;

  const errors: Set<string> = new Set();

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

    function updateLedgerBalance(entry: LedgerProto) {
      updateLedgerBalanceByEntry(entry, ledgerBalance, context);
    }

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    const gotRelevantDocuments =
      Number(charge.invoices_count ?? 0) + Number(charge.receipts_count ?? 0) > 0;
    const gotTransactions = !!charge.transactions_count;

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
            resolve(defaultTaxCategoryId);
          }
        })
        .catch(reject);
    });

    const documentsPromise = gotRelevantDocuments
      ? injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId)
      : Promise.resolve([]);

    const transactionsPromise = gotTransactions
      ? injector.get(TransactionsProvider).getTransactionsByChargeIDLoader.load(chargeId)
      : Promise.resolve([]);

    const unbalancedBusinessesPromise = injector
      .get(UnbalancedBusinessesProvider)
      .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);

    const chargeBallanceCancellationsPromise = injector
      .get(BalanceCancellationProvider)
      .getBalanceCancellationByChargesIdLoader.load(chargeId);

    const [
      documentsTaxCategoryId,
      documents,
      transactions,
      unbalancedBusinesses,
      balanceCancellations,
    ] = await Promise.all([
      documentsTaxCategoryIdPromise,
      documentsPromise,
      transactionsPromise,
      unbalancedBusinessesPromise,
      chargeBallanceCancellationsPromise,
    ]);

    const entriesPromises: Array<Promise<void>> = [];
    const documentsLedgerEntries: LedgerProto[] = [];
    const mainTransactionsLedgerEntries: StrictLedgerProto[] = [];
    const feeTransactionsAccountLedgerEntries: LedgerProto[] = [];
    const miscLedgerEntries: LedgerProto[] = [];
    const extensionLedgerEntries: LedgerProto[] = [];

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
          context,
          chargeId,
          charge.owner_id,
          documentsTaxCategoryId!,
        )
          .then(async ledgerEntry => {
            updateLedgerBalance(ledgerEntry);
            await getDeelEmployeeId(context, document, ledgerEntry, extensionLedgerEntries);
            documentsLedgerEntries.push(ledgerEntry);
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

    // generate ledger from transactions
    if (gotTransactions) {
      const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

      // for each transaction, create a ledger record
      const mainTransactionsPromises = mainTransactions.map(async transaction => {
        const ledgerEntry = await ledgerEntryFromMainTransaction(
          transaction,
          context,
          chargeId,
          charge.owner_id,
          charge.business_id ?? undefined,
          gotRelevantDocuments,
        ).catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });

        if (!ledgerEntry) {
          return;
        }

        mainTransactionsLedgerEntries.push(ledgerEntry);
        updateLedgerBalance(ledgerEntry);
        dates.add(ledgerEntry.valueDate.getTime());
        currencies.add(ledgerEntry.currency);
      });

      // create a ledger record for fee transactions
      const feeTransactionsPromises = feeTransactions.map(async transaction => {
        const ledgerEntries = await getEntriesFromFeeTransaction(
          transaction,
          charge,
          context,
        ).catch(e => {
          if (e instanceof LedgerError) {
            errors.add(e.message);
          } else {
            throw e;
          }
        });

        if (!ledgerEntries) {
          return;
        }

        feeTransactionsAccountLedgerEntries.push(...ledgerEntries);
        ledgerEntries.map(ledgerEntry => {
          updateLedgerBalance(ledgerEntry);
          dates.add(ledgerEntry.valueDate.getTime());
          currencies.add(ledgerEntry.currency);
        });
      });

      entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    }

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        miscLedgerEntries.push(entry);
        updateLedgerBalance(entry);
        dates.add(entry.valueDate.getTime());
        currencies.add(entry.currency);
      });
    });
    entriesPromises.push(expensesLedgerPromise);

    await Promise.all(entriesPromises);

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );

    // multiple currencies balance
    const mainBusiness = charge.business_id;
    const businessBalance = ledgerBalance.get(mainBusiness ?? '');
    if (
      mainBusiness &&
      Object.keys(businessBalance?.foreignAmounts ?? {}).length >
        (charge.invoice_payment_currency_diff ? 0 : 1)
    ) {
      const transactionEntries = mainTransactionsLedgerEntries.filter(entry => {
        if ([entry.creditAccountID1, entry.debitAccountID1].includes(mainBusiness)) return true;
        return false;
      });
      const documentEntries = documentsLedgerEntries.filter(entry => {
        if ([entry.creditAccountID1, entry.debitAccountID1].includes(mainBusiness)) return true;
        return false;
      });

      try {
        const entries = multipleForeignCurrenciesBalanceEntries(
          context,
          documentEntries,
          transactionEntries,
          charge,
          businessBalance!.foreignAmounts!,
          charge.invoice_payment_currency_diff ?? false,
        );
        for (const ledgerEntry of entries) {
          extensionLedgerEntries.push(ledgerEntry);
          updateLedgerBalance(ledgerEntry);
        }
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
        } else {
          throw e;
        }
      }
    }

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      try {
        const ledgerEntry = ledgerEntryFromBalanceCancellation(
          balanceCancellation,
          ledgerBalance,
          mainTransactionsLedgerEntries,
          chargeId,
          charge.owner_id,
          context,
        );

        extensionLedgerEntries.push(ledgerEntry);
        updateLedgerBalance(ledgerEntry);
      } catch (e) {
        if (e instanceof LedgerError) {
          errors.add(e.message);
          continue;
        } else {
          throw e;
        }
      }
    }

    // check for balance and return ledger if errors
    const { balanceSum, isBalanced, unbalancedEntities, financialEntities } =
      await getLedgerBalanceInfo(context, ledgerBalance, undefined, allowedUnbalancedBusinesses);
    if (errors.size) {
      const records = [
        ...mainTransactionsLedgerEntries,
        ...feeTransactionsAccountLedgerEntries,
        ...documentsLedgerEntries,
        ...miscLedgerEntries,
        ...extensionLedgerEntries,
      ];
      if (records.length && insertLedgerRecordsIfNotExists) {
        await storeInitialGeneratedRecords(charge, records, context);
      }
      return {
        records: ledgerProtoToRecordsConverter(records),
        charge,
        balance: { balanceSum, isBalanced, unbalancedEntities },
        errors: Array.from(errors),
      };
    }

    // handle imbalances
    const foreignCurrencyCount = currencies.size - (currencies.has(defaultLocalCurrency) ? 1 : 0);
    const multipleForeignCurrencies = foreignCurrencyCount >= 2;

    // check for foreign currencies imbalance
    if (multipleForeignCurrencies) {
      const records = [
        ...mainTransactionsLedgerEntries,
        ...documentsLedgerEntries,
        ...miscLedgerEntries,
      ].filter(entry => {
        if (entry.creditAccountID1 === mainBusiness || entry.debitAccountID1 === mainBusiness) {
          return true;
        }
        return false;
      });
      const balance = {
        defaultLocalAmount: 0,
        defaultForeignAmount: 0,
        totalForeignDebit: 0,
        totalForeignCredit: 0,
      };
      for (const entry of records) {
        const isCreditorMain = entry.creditAccountID1 === mainBusiness;
        let exchangeRate = 1;
        if (entry.currency !== defaultCryptoConversionFiatCurrency) {
          exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(entry.currency, defaultCryptoConversionFiatCurrency, entry.valueDate);
        }
        const amount = isCreditorMain
          ? (entry.debitAmount1 ?? 0) + (entry.debitAmount2 ?? 0)
          : (entry.creditAmount1 ?? 0) + (entry.creditAmount2 ?? 0);
        balance.defaultLocalAmount += isCreditorMain
          ? -(entry.localCurrencyDebitAmount1 ?? 0) - (entry.localCurrencyDebitAmount2 ?? 0)
          : (entry.localCurrencyCreditAmount1 ?? 0) + (entry.localCurrencyCreditAmount2 ?? 0);
        balance.defaultForeignAmount += amount * exchangeRate * (isCreditorMain ? 1 : -1);
        balance.totalForeignDebit += isCreditorMain ? amount : 0;
        balance.totalForeignCredit += isCreditorMain ? 0 : amount;
      }

      if (Math.abs(balance.defaultForeignAmount) > 0.005) {
        const maxTotalAmount = Math.max(balance.totalForeignDebit, balance.totalForeignCredit);
        const percent = (Math.abs(balance.defaultForeignAmount) / maxTotalAmount) * 100;
        errors.add(
          `Failed to balance: ${formatFinancialAmount(balance.defaultForeignAmount, defaultCryptoConversionFiatCurrency).formatted} diff, ${percent.toFixed(2)}% of total charge amount;`,
        );
      }
    }

    if (Math.abs(balanceSum) > 0.005) {
      errors.add(
        `Failed to balance: ${formatStringifyAmount(balanceSum)} diff; ${unbalancedEntities.map(entity => entity.entityId).join(', ')} are not balanced`,
      );
    } else if (!isBalanced) {
      // check if business doesn't require documents
      if (!documentsLedgerEntries.length && charge.business_id) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(charge.business_id);
        if (business?.no_invoices_required) {
          const unbalancedBusinesses = unbalancedEntities.find(b => b.entityId === business.id);
          if (unbalancedBusinesses) {
            errors.add(`Business "${business.name}" is unbalanced (in the scope of this charge)`);
          } else {
            errors.add('Some businesses are not balanced in the scope of this charge');
          }
          const records = [
            ...mainTransactionsLedgerEntries,
            ...feeTransactionsAccountLedgerEntries,
          ];

          if (insertLedgerRecordsIfNotExists) {
            await storeInitialGeneratedRecords(charge, records, context);
          }

          return {
            records: ledgerProtoToRecordsConverter(records),
            charge,
            balance: { balanceSum, isBalanced, unbalancedEntities },
            errors: Array.from(errors),
          };
        }
      }

      // check if exchange rate record is needed

      const hasMultipleDates = dates.size > 1;
      const mightRequireExchangeRateRecord =
        (hasMultipleDates && !!foreignCurrencyCount) || multipleForeignCurrencies;
      const unbalancedBusinesses = unbalancedEntities.filter(
        ({ entityId }) =>
          financialEntities.some(fe => fe.id === entityId && fe.type === 'business') &&
          !allowedUnbalancedBusinesses.has(entityId),
      );

      if (mightRequireExchangeRateRecord && unbalancedBusinesses.length === 1) {
        const transactionEntry = mainTransactionsLedgerEntries[0];
        const entryDate = getExchangeDates(mainTransactionsLedgerEntries);

        const { entityId, balance } = unbalancedBusinesses[0];
        const amount = Math.abs(balance.raw);
        const isCreditorCounterparty = balance.raw < 0;

        const exchangeRateEntry = documentsLedgerEntries.find(entry =>
          [entry.creditAccountID1, entry.debitAccountID1].includes(entityId),
        );

        let exchangeRateTaxCategory: string | undefined = undefined;
        if (exchangeRateEntry) {
          if (documentsTaxCategoryId) {
            exchangeRateTaxCategory = documentsTaxCategoryId;
          } else {
            exchangeRateTaxCategory =
              exchangeRateEntry.debitAccountID1 === entityId
                ? exchangeRateEntry.creditAccountID1
                : exchangeRateEntry.debitAccountID1;
          }

          const isRefund = isRefundCharge(charge.user_description);
          const isIncomeCharge =
            !isRefund && charge.event_amount && Number(charge.event_amount) > 0;
          if (isIncomeCharge) {
            exchangeRateTaxCategory = incomeExchangeRateTaxCategoryId;
          }
        } else if (charge.documents_optional_flag) {
          exchangeRateTaxCategory = exchangeRateTaxCategoryId;
        }

        // validate exchange rate

        const validation = validateExchangeRate(
          entityId,
          [
            ...documentsLedgerEntries,
            ...mainTransactionsLedgerEntries,
            ...feeTransactionsAccountLedgerEntries,
            ...miscLedgerEntries,
            ...extensionLedgerEntries,
          ],
          balance.raw,
          defaultLocalCurrency,
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
              invoiceDate: entryDate,
              valueDate: entryDate,
              currency: defaultLocalCurrency,
              ownerId: transactionEntry.ownerId,
              chargeId,
            };
            extensionLedgerEntries.push(ledgerEntry);
            updateLedgerBalance(ledgerEntry);
          } else {
            errors.add(
              `Failed to locate tax category for exchange rate for business ID="${entityId}"`,
            );
          }
        } else {
          errors.add(validation);
        }
      } else {
        errors.add(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${foreignCurrencyCount ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    const crossYearLedgerEntries = await handleCrossYearLedgerEntries(
      charge,
      context,
      documentsLedgerEntries,
    );

    const records = [
      ...(crossYearLedgerEntries ?? documentsLedgerEntries),
      ...mainTransactionsLedgerEntries,
      ...feeTransactionsAccountLedgerEntries,
      ...miscLedgerEntries,
      ...extensionLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, records, context);
    }

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      context,
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
    const message = `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`;
    console.error(message);
    return {
      __typename: 'CommonError',
      message,
    };
  }
};
