import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import {
  ledgerEntryFromBalanceCancellation,
  ledgerEntryFromDocument,
  ledgerEntryFromMainTransaction,
} from '@modules/ledger/helpers/common-charge-ledger.helper.js';
import { handleCrossYearLedgerEntries } from '@modules/ledger/helpers/cross-year-ledger.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  DEFAULT_TAX_CATEGORY,
  INCOME_EXCHANGE_RATE_TAX_CATEGORY_ID,
} from '@shared/constants';
import type {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatStringifyAmount } from '@shared/helpers';
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
  object
> = async (charge, _, { injector }) => {
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
            resolve(DEFAULT_TAX_CATEGORY);
          }
        })
        .catch(reject);
    });

    const documentsPromise = gotRelevantDocuments
      ? injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId)
      : [];

    const transactionsPromise = gotTransactions
      ? injector.get(TransactionsProvider).getTransactionsByChargeIDLoader.load(chargeId)
      : [];

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
    const accountingLedgerEntries: LedgerProto[] = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];

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

    // generate ledger from transactions
    if (gotTransactions) {
      const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

      // for each transaction, create a ledger record
      const mainTransactionsPromises = mainTransactions.map(async transaction => {
        const ledgerEntry = await ledgerEntryFromMainTransaction(
          transaction,
          injector,
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

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(ledgerEntry.valueDate.getTime());
        currencies.add(ledgerEntry.currency);
      });

      // create a ledger record for fee transactions
      const feeTransactionsPromises = feeTransactions.map(async transaction => {
        await getEntriesFromFeeTransaction(transaction, charge, injector)
          .then(ledgerEntries => {
            feeFinancialAccountLedgerEntries.push(...ledgerEntries);
            ledgerEntries.map(ledgerEntry => {
              updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
              dates.add(ledgerEntry.valueDate.getTime());
              currencies.add(ledgerEntry.currency);
            });
          })
          .catch(e => {
            if (e instanceof LedgerError) {
              errors.add(e.message);
            } else {
              throw e;
            }
          });
      });

      entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    }

    await Promise.all(entriesPromises);

    const miscLedgerEntries: LedgerProto[] = [];

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      try {
        const ledgerEntry = ledgerEntryFromBalanceCancellation(
          balanceCancellation,
          ledgerBalance,
          financialAccountLedgerEntries,
          chargeId,
          charge.owner_id,
        );

        miscLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
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

    // Add ledger completion entries
    const { balanceSum, isBalanced, unbalancedEntities, financialEntities } =
      await getLedgerBalanceInfo(injector, ledgerBalance, errors, allowedUnbalancedBusinesses);
    if (errors.size) {
      const records = [
        ...financialAccountLedgerEntries,
        ...feeFinancialAccountLedgerEntries,
        ...accountingLedgerEntries,
        ...miscLedgerEntries,
      ];
      if (records.length) {
        await storeInitialGeneratedRecords(charge, records, injector);
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
      if (!accountingLedgerEntries.length && charge.business_id) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(charge.business_id);
        if (business?.no_invoices_required) {
          const records = [...financialAccountLedgerEntries, ...feeFinancialAccountLedgerEntries];
          await storeInitialGeneratedRecords(charge, records, injector);
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
      const foreignCurrencyCount =
        currencies.size - (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);

      const mightRequireExchangeRateRecord =
        (hasMultipleDates && !!foreignCurrencyCount) || foreignCurrencyCount >= 2;
      const unbalancedBusinesses = unbalancedEntities.filter(({ entityId }) =>
        financialEntities.some(fe => fe.id === entityId && fe.type === 'business'),
      );

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
            currency: transactionEntry.currency, // NOTE: this field is dummy
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
        errors.add(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${foreignCurrencyCount ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    const crossYearLedgerEntries = handleCrossYearLedgerEntries(
      charge,
      accountingLedgerEntries,
      financialAccountLedgerEntries,
    );

    const records = [
      ...(crossYearLedgerEntries ?? accountingLedgerEntries),
      ...financialAccountLedgerEntries,
      ...feeFinancialAccountLedgerEntries,
      ...miscLedgerEntries,
    ];
    await storeInitialGeneratedRecords(charge, records, injector);

    const ledgerBalanceInfo = await getLedgerBalanceInfo(
      injector,
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
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
