import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { getRateForCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import type { IGetAllTaxCategoriesResult } from '@modules/financial-entities/types';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { currency, IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import {
  DEFAULT_LOCAL_CURRENCY,
  EXCHANGE_RATE_CATEGORY_NAME,
  FEE_CATEGORY_NAME,
  VAT_TAX_CATEGORY_NAME,
} from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import type { CounterAccountProto, LedgerProto, StrictLedgerProto } from '@shared/types';
import { isSupplementalFeeTransaction, splitFeeTransactions } from '../helpers/fee-transactions.js';
import {
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
} from '../helpers/utils.helper.js';
import { UnbalancedBusinessesProvider } from '../providers/unbalanced-businesses.provider.js';

export const generateLedgerRecordsForCommonCharge: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entity: CounterAccountProto }>();

    const dates = new Set<number>();
    const currencies = new Set<currency>();

    // generate ledger from documents
    const accountingLedgerEntries: LedgerProto[] = [];
    if (Number(charge.invoices_count ?? '0') + Number(charge.receipts_count ?? 0) > 0) {
      const counterpartyTaxCategory = await (charge.tax_category_id
        ? injector.get(TaxCategoriesProvider).taxCategoryByIDsLoader.load(charge.tax_category_id)
        : injector.get(TaxCategoriesProvider).taxCategoryByChargeIDsLoader.load(charge.id));
      if (!counterpartyTaxCategory) {
        throw new GraphQLError(`Tax category not found for charge ID="${charge.id}"`);
      }

      // Get all relevant documents for charge
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
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
      for (const document of relevantDocuments) {
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

        const debitAccountID1 = isCreditorCounterparty ? counterpartyTaxCategory : counterpartyId;
        const creditAccountID1 = isCreditorCounterparty ? counterpartyId : counterpartyTaxCategory;
        let creditAccountID2: IGetAllTaxCategoriesResult | null = null;
        let debitAccountID2: IGetAllTaxCategoriesResult | null = null;

        if (!document.currency_code) {
          throw new GraphQLError(`Document ID="${document.id}" is missing currency code`);
        }
        const currency = formatCurrency(document.currency_code);
        let foreignTotalAmount: number | null = null;
        let amountWithoutVat = totalAmount;
        let foreignAmountWithoutVat: number | null = null;
        let vatAmount = document.vat_amount == null ? null : Math.abs(document.vat_amount);
        let foreignVatAmount: number | null = null;
        let vatTaxCategory: IGetAllTaxCategoriesResult | null = null;

        if (vatAmount && vatAmount > 0) {
          amountWithoutVat = amountWithoutVat - vatAmount;
          await injector
            .get(TaxCategoriesProvider)
            .taxCategoryByNamesLoader.load(VAT_TAX_CATEGORY_NAME)
            .then(res => {
              vatTaxCategory = res ?? null;
            });
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

        // const date3: null = null; // TODO: rethink
        // const reference2: string | null = ''; // TODO: rethink
        // const movementType: string | null = ''; // TODO: rethink

        const ledgerEntry = {
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
        };

        accountingLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(document.date.getTime());
        currencies.add(document.currency_code);
      }
    }

    // generate ledger from transactions
    let transactions: Array<IGetTransactionsByChargeIdsResult> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];
    if (charge.transactions_count) {
      // Get all transactions
      transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(chargeId);
      const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

      // for each transaction, create a ledger record
      for (const transaction of mainTransactions) {
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

        const account = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
        if (!account) {
          throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
        }
        const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, currency);
        const taxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(taxCategoryName);
        if (!taxCategory) {
          throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
        }

        const isCreditorCounterparty = amount > 0;

        const ledgerEntry = {
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate,
          currency,
          creditAccountID1: isCreditorCounterparty ? transactionBusinessId : taxCategory,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? taxCategory : transactionBusinessId,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
          currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(valueDate.getTime());
        currencies.add(currency);
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

        const feeTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(FEE_CATEGORY_NAME);
        if (!feeTaxCategory) {
          throw new GraphQLError(`Tax category "${FEE_CATEGORY_NAME}" not found`);
        }

        const isCreditorCounterparty = amount > 0;

        let mainAccount: CounterAccountProto = transactionBusinessId;

        const partialLedgerEntry: Omit<StrictLedgerProto, 'creditAccountID1' | 'debitAccountID1'> =
          {
            id: transaction.id,
            invoiceDate: transaction.event_date,
            valueDate,
            currency,
            creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
            localCurrencyCreditAmount1: Math.abs(amount),
            debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
            localCurrencyDebitAmount1: Math.abs(amount),
            description: transaction.source_description ?? undefined,
            reference1: transaction.source_id,
            isCreditorCounterparty: isSupplementalFee
              ? isCreditorCounterparty
              : !isCreditorCounterparty,
            ownerId: charge.owner_id,
            currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
          };

        if (isSupplementalFee) {
          const account = await injector
            .get(FinancialAccountsProvider)
            .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
          if (!account) {
            throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
          }
          const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, currency);
          const businessTaxCategory = await injector
            .get(TaxCategoriesProvider)
            .taxCategoryByNamesLoader.load(taxCategoryName);
          if (!businessTaxCategory) {
            throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
          }

          mainAccount = businessTaxCategory;
        } else {
          const mainBusiness = charge.business_id ?? undefined;

          const ledgerEntry: LedgerProto = {
            ...partialLedgerEntry,
            creditAccountID1: isCreditorCounterparty ? mainAccount : mainBusiness,
            debitAccountID1: isCreditorCounterparty ? mainBusiness : mainAccount,
          };

          feeFinancialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        }

        const ledgerEntry: StrictLedgerProto = {
          ...partialLedgerEntry,
          creditAccountID1: isCreditorCounterparty ? feeTaxCategory : mainAccount,
          debitAccountID1: isCreditorCounterparty ? mainAccount : feeTaxCategory,
        };

        feeFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        dates.add(ledgerEntry.valueDate.getTime());
        currencies.add(ledgerEntry.currency);
      }
    }

    const unbalancedBusinesses = await injector
      .get(UnbalancedBusinessesProvider)
      .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);
    const allowedUnbalancedBusinesses = new Set(
      unbalancedBusinesses.map(({ business_id }) => business_id),
    );

    const miscLedgerEntries: StrictLedgerProto[] = [];
    // Add ledger completion entries
    const tempLedgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses);
    const { balanceSum, isBalanced, unbalancedEntities } = tempLedgerBalanceInfo;
    if (Math.abs(balanceSum) > 0.005) {
      throw new GraphQLError(
        `Failed to balance: ${balanceSum} diff; ${unbalancedEntities.join(', ')} are unbalanced`,
      );
    } else if (!isBalanced) {
      // check if business doesn't require documents
      if (!accountingLedgerEntries.length && charge.business_id) {
        const business = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(charge.business_id);
        if (business?.no_invoices_required) {
          return {
            records: [...financialAccountLedgerEntries, ...feeFinancialAccountLedgerEntries],
            ledgerBalanceInfo: tempLedgerBalanceInfo,
          };
        }
      }

      // check if exchange rate record is needed
      const hasMultipleDates = dates.size > 1;
      const foreignCurrencyCount =
        currencies.size - (currencies.has(DEFAULT_LOCAL_CURRENCY) ? 1 : 0);
      const mightRequireExchangeRateRecord =
        (hasMultipleDates && foreignCurrencyCount) || foreignCurrencyCount >= 2;
      if (mightRequireExchangeRateRecord && unbalancedEntities.length === 1) {
        const transactionEntry = financialAccountLedgerEntries[0];
        const documentEntry = accountingLedgerEntries[0];

        const exchangeCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(EXCHANGE_RATE_CATEGORY_NAME);
        if (!exchangeCategory) {
          throw new GraphQLError(`Tax category "${EXCHANGE_RATE_CATEGORY_NAME}" not found`);
        }

        const { entity, balance } = unbalancedEntities[0];
        const amount = Math.abs(balance.raw);
        const isCreditorCounterparty = balance.raw < 0;

        const ledgerEntry = {
          id: transactionEntry.id + '|fee', // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? entity : exchangeCategory,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? exchangeCategory : entity,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: documentEntry.invoiceDate,
          valueDate: transactionEntry.valueDate,
          currency: transactionEntry.currency, // NOTE: this field is dummy
          ownerId: transactionEntry.ownerId,
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

    const ledgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses);
    return {
      records: [
        ...accountingLedgerEntries,
        ...financialAccountLedgerEntries,
        ...feeFinancialAccountLedgerEntries,
        ...miscLedgerEntries,
      ],
      ledgerBalanceInfo,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
