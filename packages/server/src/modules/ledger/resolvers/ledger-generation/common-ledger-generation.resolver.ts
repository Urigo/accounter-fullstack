import {
  calculateTotalAmount,
  getChargeBusinesses,
  getChargeDocumentsMeta,
  getChargeTaxCategoryId,
} from '@modules/charges/helpers/common.helper.js';
import { getDeelEmployeeId, isDeelDocument } from '@modules/deel/helpers/deel.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
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
import { formatStringifyAmount } from '@shared/helpers';
import type {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../__generated__/types.js';
import type { LedgerProto, StrictLedgerProto } from '../../../../shared/types/index.js';
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

    const [{ invoiceCount, receiptCount }, formattedChargeAmount] = await Promise.all([
      getChargeDocumentsMeta(chargeId, injector),
      calculateTotalAmount(chargeId, injector, context.adminContext.defaultLocalCurrency),
    ]);
    const gotRelevantDocuments = invoiceCount + receiptCount > 0;

    const documentsTaxCategoryIdPromise = async () => {
      if (charge.tax_category_id) {
        return charge.tax_category_id;
      }

      const taxCategoryId = await getChargeTaxCategoryId(chargeId, injector);
      if (taxCategoryId) {
        return taxCategoryId;
      }

      if (!gotRelevantDocuments) {
        return undefined;
      }

      errors.add('Tax category not found');
      return defaultTaxCategoryId;
    };

    const documentsPromise = gotRelevantDocuments
      ? injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId)
      : Promise.resolve([]);

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId);

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
      { mainBusinessId },
    ] = await Promise.all([
      documentsTaxCategoryIdPromise(),
      documentsPromise,
      transactionsPromise,
      unbalancedBusinessesPromise,
      chargeBallanceCancellationsPromise,
      getChargeBusinesses(chargeId, injector),
    ]);

    const entriesPromises: Array<Promise<void>> = [];
    const accountingLedgerEntries: LedgerProto[] = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    const miscLedgerEntries: LedgerProto[] = [];

    // generate ledger from documents
    if (gotRelevantDocuments) {
      // Get all relevant documents for charge
      const relevantDocuments = documents.filter(d =>
        ['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE'].includes(d.type),
      );

      // if no relevant documents found and business can settle with receipts, look for receipts
      if (!relevantDocuments.length && mainBusinessId) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(mainBusinessId);
        if (business?.can_settle_with_receipt) {
          relevantDocuments.push(...documents.filter(d => d.type === 'RECEIPT'));
        }
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
            await getDeelEmployeeId(
              context,
              document,
              ledgerEntry,
              miscLedgerEntries,
              updateLedgerBalance,
            );
            accountingLedgerEntries.push(ledgerEntry);
            updateLedgerBalance(ledgerEntry);
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
    if (transactions.length > 0) {
      const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

      // for each transaction, create a ledger record
      const mainTransactionsPromises = mainTransactions.map(async transaction => {
        const ledgerEntry = await ledgerEntryFromMainTransaction(
          transaction,
          context,
          chargeId,
          charge.owner_id,
          mainBusinessId ?? undefined,
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

        financialAccountLedgerEntries.push(ledgerEntry);
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

        feeFinancialAccountLedgerEntries.push(...ledgerEntries);
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
        feeFinancialAccountLedgerEntries.push(entry);
        updateLedgerBalance(entry);
        dates.add(entry.valueDate.getTime());
        currencies.add(entry.currency);
      });
    });
    entriesPromises.push(expensesLedgerPromise);

    await Promise.all(entriesPromises);

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      try {
        const ledgerEntry = ledgerEntryFromBalanceCancellation(
          balanceCancellation,
          ledgerBalance,
          financialAccountLedgerEntries,
          chargeId,
          charge.owner_id,
          context,
        );

        miscLedgerEntries.push(ledgerEntry);
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

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );

    // multiple currencies balance
    const businessBalance = ledgerBalance.get(mainBusinessId ?? '');
    if (
      mainBusinessId &&
      Object.keys(businessBalance?.foreignAmounts ?? {}).length >
        (charge.invoice_payment_currency_diff ? 0 : 1)
    ) {
      const transactionEntries = financialAccountLedgerEntries.filter(entry => {
        if ([entry.creditAccountID1, entry.debitAccountID1].includes(mainBusinessId)) return true;
        return false;
      });
      const documentEntries = accountingLedgerEntries.filter(entry => {
        if ([entry.creditAccountID1, entry.debitAccountID1].includes(mainBusinessId)) return true;
        return false;
      });

      try {
        const entries = await multipleForeignCurrenciesBalanceEntries(
          context,
          documentEntries,
          transactionEntries,
          charge,
          businessBalance!.foreignAmounts!,
          charge.invoice_payment_currency_diff ?? false,
        );
        for (const ledgerEntry of entries) {
          miscLedgerEntries.push(ledgerEntry);
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

    // Add ledger completion entries
    const { balanceSum, isBalanced, unbalancedEntities, financialEntities } =
      await getLedgerBalanceInfo(context, ledgerBalance, undefined, allowedUnbalancedBusinesses);
    if (errors.size) {
      const records = [
        ...financialAccountLedgerEntries,
        ...feeFinancialAccountLedgerEntries,
        ...accountingLedgerEntries,
        ...miscLedgerEntries,
      ];
      if (records.length && insertLedgerRecordsIfNotExists) {
        await storeInitialGeneratedRecords(charge.id, records, context);
      }
      return {
        records: ledgerProtoToRecordsConverter(records),
        charge,
        balance: { balanceSum, isBalanced, unbalancedEntities },
        errors: Array.from(errors),
      };
    }
    if (Math.abs(balanceSum) > 0.005) {
      errors.add(
        `Failed to balance: ${formatStringifyAmount(balanceSum)} diff; ${unbalancedEntities.map(entity => entity.entityId).join(', ')} are not balanced`,
      );
    } else if (!isBalanced) {
      // check if business doesn't require documents
      if (!accountingLedgerEntries.length && mainBusinessId) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(mainBusinessId);
        if (business?.no_invoices_required) {
          const unbalancedBusinesses = unbalancedEntities.find(b => b.entityId === business.id);
          if (unbalancedBusinesses) {
            errors.add(`Business "${business.name}" is unbalanced (in the scope of this charge)`);
          } else {
            errors.add('Some businesses are not balanced in the scope of this charge');
          }
          const records = [...financialAccountLedgerEntries, ...feeFinancialAccountLedgerEntries];

          if (insertLedgerRecordsIfNotExists) {
            await storeInitialGeneratedRecords(charge.id, records, context);
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
      const foreignCurrencyCount = currencies.size - (currencies.has(defaultLocalCurrency) ? 1 : 0);

      const mightRequireExchangeRateRecord =
        (hasMultipleDates && !!foreignCurrencyCount) || foreignCurrencyCount >= 2;
      const unbalancedBusinesses = unbalancedEntities.filter(
        ({ entityId }) =>
          financialEntities.some(fe => fe.id === entityId && fe.type === 'business') &&
          !allowedUnbalancedBusinesses.has(entityId),
      );

      if (mightRequireExchangeRateRecord && unbalancedBusinesses.length === 1) {
        const transactionEntry = financialAccountLedgerEntries[0];
        const entryDate = getExchangeDates(financialAccountLedgerEntries);

        const { entityId, balance } = unbalancedBusinesses[0];
        const amount = Math.abs(balance.raw);
        const isCreditorCounterparty = balance.raw < 0;

        let exchangeRateEntry = accountingLedgerEntries.find(entry =>
          [entry.creditAccountID1, entry.debitAccountID1].includes(entityId),
        );

        let exchangeRateTaxCategory: string | undefined = undefined;
        const deelCharge = documents.some(doc => isDeelDocument(doc));

        if (deelCharge) {
          exchangeRateEntry ||= miscLedgerEntries.find(entry =>
            [entry.creditAccountID1, entry.debitAccountID1].includes(entityId),
          );
        }

        if (exchangeRateEntry) {
          if (documentsTaxCategoryId) {
            exchangeRateTaxCategory = documentsTaxCategoryId;
          } else {
            exchangeRateTaxCategory =
              exchangeRateEntry.debitAccountID1 === entityId
                ? exchangeRateEntry.creditAccountID1
                : exchangeRateEntry.debitAccountID1;
          }

          if (deelCharge) {
            // If Deel - override to generic exchange rate tax category
            exchangeRateTaxCategory = exchangeRateTaxCategoryId;
          }

          const isRefund = isRefundCharge(charge.user_description);
          const isIncomeCharge =
            !isRefund && !!formattedChargeAmount && formattedChargeAmount.raw > 0;
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
            ...accountingLedgerEntries,
            ...financialAccountLedgerEntries,
            ...feeFinancialAccountLedgerEntries,
            ...miscLedgerEntries,
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
            miscLedgerEntries.push(ledgerEntry);
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
      accountingLedgerEntries,
    );

    const records = [
      ...(crossYearLedgerEntries ?? accountingLedgerEntries),
      ...financialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, records, context);
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
