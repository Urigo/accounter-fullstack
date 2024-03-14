import { GraphQLError } from 'graphql';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { getRateForCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { handleCrossYearLedgerEntries } from '@modules/ledger/helpers/cross-year-ledger.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency } from '@modules/transactions/types.js';
import {
  BALANCE_CANCELLATION_TAX_CATEGORY_ID,
  DEFAULT_LOCAL_CURRENCY,
  INPUT_VAT_TAX_CATEGORY_ID,
  INTERNAL_WALLETS_IDS,
  OUTPUT_VAT_TAX_CATEGORY_ID,
} from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  getEntriesFromFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import { storeInitialGeneratedRecords } from '../../helpers/ledgrer-storage.helper.js';
import {
  getFinancialAccountTaxCategoryId,
  getLedgerBalanceInfo,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../../helpers/utils.helper.js';
import { BalanceCancellationProvider } from '../../providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '../../providers/unbalanced-businesses.provider.js';

export const generateLedgerRecordsForCommonCharge: ResolverFn<
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

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    const shouldFetchDocuments =
      Number(charge.invoices_count ?? '0') + Number(charge.receipts_count ?? 0) > 0;
    const shouldFetchTransactions = !!charge.transactions_count;

    const documentsTaxCategoryIdPromise = shouldFetchDocuments
      ? charge.tax_category_id
        ? Promise.resolve(charge.tax_category_id)
        : injector
            .get(TaxCategoriesProvider)
            .taxCategoryByChargeIDsLoader.load(charge.id)
            .then(res => res?.id)
      : undefined;

    const documentsPromise = shouldFetchDocuments
      ? injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId)
      : [];

    const transactionsPromise = shouldFetchTransactions
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
    if (shouldFetchDocuments) {
      if (!documentsTaxCategoryId) {
        throw new GraphQLError(`Tax category not found for charge ID="${charge.id}"`);
      }

      // Get all relevant documents for charge
      const relevantDocuments = documents.filter(d =>
        ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type),
      );

      // if found invoices, looke for & add credit invoices
      if (relevantDocuments.length >= 1) {
        relevantDocuments.push(...documents.filter(d => d.type === 'CREDIT_INVOICE'));
      }

      // if no relevant documents found and business can settle with receipts, look for receipts
      if (!relevantDocuments.length && charge.can_settle_with_receipt) {
        relevantDocuments.push(...documents.filter(d => d.type === 'RECEIPT'));
      }

      // for each invoice - generate accounting ledger entry
      const documentsEntriesPromises = relevantDocuments.map(async document => {
        if (!document.date) {
          throw new GraphQLError(`Document ID="${document.id}" is missing the date`);
        }

        if (!document.debtor_id) {
          throw new GraphQLError(`Document ID="${document.id}" is missing the debtor`);
        }
        if (!document.creditor_id) {
          throw new GraphQLError(`Document ID="${document.id}" is missing the creditor`);
        }
        if (!document.total_amount) {
          throw new GraphQLError(`Document ID="${document.id}" is missing amount`);
        }
        let totalAmount = document.total_amount;

        const isCreditorCounterparty = document.debtor_id === charge.owner_id;
        const counterpartyId = isCreditorCounterparty ? document.creditor_id : document.debtor_id;
        if (totalAmount < 0) {
          totalAmount = Math.abs(totalAmount);
        }

        const debitAccountID1 = isCreditorCounterparty ? documentsTaxCategoryId : counterpartyId;
        const creditAccountID1 = isCreditorCounterparty ? counterpartyId : documentsTaxCategoryId;
        let creditAccountID2: string | null = null;
        let debitAccountID2: string | null = null;

        if (!document.currency_code) {
          throw new GraphQLError(`Document ID="${document.id}" is missing currency code`);
        }
        const currency = formatCurrency(document.currency_code);
        let foreignTotalAmount: number | null = null;
        let amountWithoutVat = totalAmount;
        let foreignAmountWithoutVat: number | null = null;
        let vatAmount = document.vat_amount == null ? null : Math.abs(document.vat_amount);
        let foreignVatAmount: number | null = null;
        let vatTaxCategory: string | null = null;

        if (vatAmount && vatAmount > 0) {
          amountWithoutVat = amountWithoutVat - vatAmount;
          vatTaxCategory = isCreditorCounterparty
            ? OUTPUT_VAT_TAX_CATEGORY_ID
            : INPUT_VAT_TAX_CATEGORY_ID;
        }

        // handle non-local currencies
        if (document.currency_code !== DEFAULT_LOCAL_CURRENCY) {
          // get exchange rate for currency
          const exchangeRates = await injector
            .get(FiatExchangeProvider)
            .getExchangeRatesByDatesLoader.load(document.date);
          const exchangeRate = getRateForCurrency(document.currency_code, exchangeRates);

          // Set foreign amounts
          foreignTotalAmount = totalAmount;
          foreignAmountWithoutVat = amountWithoutVat;

          // calculate amounts in ILS
          totalAmount = exchangeRate * totalAmount;
          amountWithoutVat = exchangeRate * amountWithoutVat;
          if (vatAmount && vatAmount > 0) {
            foreignVatAmount = vatAmount;
            vatAmount = exchangeRate * vatAmount;
          }
        }

        let creditAmount1: number | null = null;
        let localCurrencyCreditAmount1 = 0;
        let debitAmount1: number | null = null;
        let localCurrencyDebitAmount1 = 0;
        let creditAmount2: number | null = null;
        let localCurrencyCreditAmount2: number | null = null;
        let debitAmount2: number | null = null;
        let localCurrencyDebitAmount2: number | null = null;
        if (isCreditorCounterparty) {
          localCurrencyCreditAmount1 = totalAmount;
          creditAmount1 = foreignTotalAmount;
          localCurrencyDebitAmount1 = amountWithoutVat;
          debitAmount1 = foreignAmountWithoutVat;

          if (vatAmount && vatAmount > 0) {
            // add vat to debtor2
            debitAmount2 = foreignVatAmount;
            localCurrencyDebitAmount2 = vatAmount;
            debitAccountID2 = vatTaxCategory;
          }
        } else {
          localCurrencyDebitAmount1 = totalAmount;
          debitAmount1 = foreignTotalAmount;
          localCurrencyCreditAmount1 = amountWithoutVat;
          creditAmount1 = foreignAmountWithoutVat;

          if (vatAmount && vatAmount > 0) {
            // add vat to creditor2
            creditAmount2 = foreignVatAmount;
            localCurrencyCreditAmount2 = vatAmount;
            creditAccountID2 = vatTaxCategory;
          }
        }

        const ledgerEntry: StrictLedgerProto = {
          id: document.id,
          invoiceDate: document.date,
          valueDate: document.date,
          currency,
          creditAccountID1,
          creditAmount1: creditAmount1 ?? undefined,
          localCurrencyCreditAmount1,
          debitAccountID1,
          debitAmount1: debitAmount1 ?? undefined,
          localCurrencyDebitAmount1,
          creditAccountID2: creditAccountID2 ?? undefined,
          creditAmount2: creditAmount2 ?? undefined,
          localCurrencyCreditAmount2: localCurrencyCreditAmount2 ?? undefined,
          debitAccountID2: debitAccountID2 ?? undefined,
          debitAmount2: debitAmount2 ?? undefined,
          localCurrencyDebitAmount2: localCurrencyDebitAmount2 ?? undefined,
          description: document.description ?? undefined,
          reference1: document.serial_number ?? undefined,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          chargeId,
        };

        accountingLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(document.date.getTime());
        currencies.add(document.currency_code);
      });

      entriesPromises.push(...documentsEntriesPromises);
    }

    // generate ledger from transactions
    if (shouldFetchTransactions) {
      const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

      // for each transaction, create a ledger record
      const mainTransactionsPromises = mainTransactions.map(async transaction => {
        const { currency, valueDate, transactionBusinessId } =
          validateTransactionBasicVariables(transaction);

        let mainAccountId: string = transactionBusinessId;

        if (
          !shouldFetchDocuments &&
          transaction.source_reference &&
          charge.business_id &&
          INTERNAL_WALLETS_IDS.includes(charge.business_id)
        ) {
          mainAccountId = await getFinancialAccountTaxCategoryId(
            injector,
            transaction,
            currency,
            true,
          );
        }

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

        const ledgerEntry: StrictLedgerProto = {
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty ? mainAccountId : accountTaxCategoryId,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? accountTaxCategoryId : mainAccountId,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          chargeId,
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(valueDate.getTime());
        currencies.add(currency);
      });

      // create a ledger record for fee transactions
      const feeTransactionsPromises = feeTransactions.map(async transaction => {
        await getEntriesFromFeeTransaction(transaction, charge, context).then(ledgerEntries => {
          feeFinancialAccountLedgerEntries.push(...ledgerEntries);
          ledgerEntries.map(ledgerEntry => {
            updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
            dates.add(ledgerEntry.valueDate.getTime());
            currencies.add(ledgerEntry.currency);
          });
        });
      });

      entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    }

    await Promise.all(entriesPromises);

    const miscLedgerEntries: LedgerProto[] = [];

    // generate ledger from balance cancellation
    for (const balanceCancellation of balanceCancellations) {
      const entityBalance = ledgerBalance.get(balanceCancellation.business_id);
      if (!entityBalance) {
        console.log(
          `Balance cancellation for business ${balanceCancellation.business_id} redundant - already balanced`,
        );
        continue;
      }

      const { amount, entityId } = entityBalance;

      const financialAccountEntry = financialAccountLedgerEntries.find(entry =>
        [
          entry.creditAccountID1,
          entry.creditAccountID2,
          entry.debitAccountID1,
          entry.debitAccountID2,
        ].includes(balanceCancellation.business_id),
      );
      if (!financialAccountEntry) {
        throw new GraphQLError(
          `Balance cancellation for business ${balanceCancellation.business_id} failed - no financial account entry found`,
        );
      }

      let foreignAmount: number | undefined = undefined;

      if (
        financialAccountEntry.currency !== DEFAULT_LOCAL_CURRENCY &&
        financialAccountEntry.currencyRate
      ) {
        foreignAmount = financialAccountEntry.currencyRate * amount;
      }

      const isCreditorCounterparty = amount > 0;

      const ledgerEntry: LedgerProto = {
        id: balanceCancellation.charge_id,
        invoiceDate: financialAccountEntry.invoiceDate,
        valueDate: financialAccountEntry.valueDate,
        currency: financialAccountEntry.currency,
        creditAccountID1: isCreditorCounterparty ? BALANCE_CANCELLATION_TAX_CATEGORY_ID : entityId,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? entityId : BALANCE_CANCELLATION_TAX_CATEGORY_ID,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: balanceCancellation.description ?? undefined,
        reference1: financialAccountEntry.reference1,
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: financialAccountEntry.currencyRate,
        chargeId,
      };

      miscLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    }

    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );

    // Add ledger completion entries
    const { balanceSum, isBalanced, unbalancedEntities, financialEntities } =
      await getLedgerBalanceInfo(injector, ledgerBalance, allowedUnbalancedBusinesses);
    if (Math.abs(balanceSum) > 0.005) {
      throw new GraphQLError(
        `Failed to balance: ${balanceSum} diff; ${unbalancedEntities.join(', ')} are unbalanced`,
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
          };
        }
      }

      // check if exchange rate record is needed
      const hasMultipleDates = dates.size > 1;
      const foreignCurrencyCount =
        currencies.size - (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);
      const mightRequireExchangeRateRecord =
        (hasMultipleDates && foreignCurrencyCount) || foreignCurrencyCount >= 2;
      const unbalancedBusinesses = unbalancedEntities.filter(({ entityId }) =>
        financialEntities.some(fe => fe.id === entityId && fe.type === 'business'),
      );
      if (mightRequireExchangeRateRecord && unbalancedBusinesses.length === 1) {
        const transactionEntry = financialAccountLedgerEntries[0];
        const documentEntry = accountingLedgerEntries[0];

        const { entityId, balance } = unbalancedBusinesses[0];
        const amount = Math.abs(balance.raw);
        const isCreditorCounterparty = balance.raw < 0;

        const exchangeRateTaxCategory = [
          ...financialAccountLedgerEntries,
          ...accountingLedgerEntries,
        ].find(entry =>
          isCreditorCounterparty
            ? entry.creditAccountID1 === entityId
            : entry.debitAccountID1 === entityId,
        )?.[isCreditorCounterparty ? 'debitAccountID1' : 'creditAccountID1'];

        if (!exchangeRateTaxCategory) {
          throw new GraphQLError(
            `Failed to locate tax category for exchange rate for business ID="${entityId}"`,
          );
        }

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
        throw new GraphQLError(
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
      allowedUnbalancedBusinesses,
    );
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
