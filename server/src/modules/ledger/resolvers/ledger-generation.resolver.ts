import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { getRateForCurrency } from '@modules/exchange-rates/helpers/exchange.helper.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import type { IGetAllTaxCategoriesResult } from '@modules/financial-entities/types';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { currency } from '@modules/transactions/types.js';
import { EXCHANGE_RATE_CATEGORY_NAME, VAT_TAX_CATEGORY_NAME } from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';

export const generateLedgerRecords: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  try {
    const accountingLedgerEntries: LedgerProto[] = [];

    // validate ledger records are balanced
    let ledgerBalance = 0;

    const dates = new Set<Date>();
    const currencies = new Set<currency>();

    if (Number(charge.invoices_count ?? '0') + Number(charge.receipts_count ?? 0) > 0) {
      // Get all relevant documents for charge
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
      const relevantDocuments = documents.filter(d =>
        ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type),
      );

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

        const counterpartyTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByChargeIDsLoader.load(charge.id);
        if (!counterpartyTaxCategory) {
          throw new GraphQLError(`Tax category not found for charge ID="${charge.id}"`);
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
        if (document.currency_code !== 'ILS') {
          // get exchange rate for currency
          const exchangeRates = await injector
            .get(ExchangeProvider)
            .getExchangeRates(document.date);
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

        accountingLedgerEntries.push({
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
        });

        if (isCreditorCounterparty) {
          ledgerBalance += totalAmount;
        } else {
          ledgerBalance -= totalAmount;
        }

        dates.add(document.date);
        currencies.add(document.currency_code);
      }
    }

    const financialAccountLedgerEntries: LedgerProto[] = [];

    if (charge.transactions_count) {
      // Get all transactions
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(chargeId);

      // for each transaction, create a ledger record
      for (const transaction of transactions) {
        let amount = Number(transaction.amount);
        let foreignAmount: number | undefined = undefined;

        const currencyCode = transaction.currency;

        if (!transaction.debit_date) {
          throw new GraphQLError(
            `Transaction ID="${transaction.id}" is missing debit date for currency ${currencyCode}`,
          );
        }

        if (currencyCode !== 'ILS') {
          // get exchange rate for currency
          const exchangeRates = await injector
            .get(ExchangeProvider)
            .getExchangeRates(transaction.debit_date);
          const exchangeRate = getRateForCurrency(currencyCode, exchangeRates);

          foreignAmount = amount;
          // calculate amounts in ILS
          amount = exchangeRate * amount;
        }

        if (!transaction.business_id) {
          throw new GraphQLError(`Transaction ID="${transaction.id}" is missing business_id`);
        }

        const counterpartyId = transaction.business_id;

        const account = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
        if (!account) {
          throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
        }
        let taxCategoryName = account.hashavshevet_account_ils;
        switch (transaction.currency) {
          case 'ILS':
            taxCategoryName = account.hashavshevet_account_ils;
            break;
          case 'USD':
            taxCategoryName = account.hashavshevet_account_usd;
            break;
          case 'EUR':
            taxCategoryName = account.hashavshevet_account_eur;
            break;
          case 'GBP':
            taxCategoryName = account.hashavshevet_account_gbp;
            break;
          default:
            console.error(`Unknown currency for account's tax category: ${transaction.currency}`);
        }
        if (!taxCategoryName) {
          throw new GraphQLError(`Account ID="${account.id}" is missing tax category name`);
        }
        const taxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(taxCategoryName);
        if (!taxCategory) {
          throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
        }

        const isCreditorCounterparty = amount > 0;

        ledgerBalance += amount;

        const currency = formatCurrency(currencyCode);

        financialAccountLedgerEntries.push({
          id: transaction.id,
          invoiceDate: transaction.event_date,
          valueDate: transaction.debit_date,
          currency,
          creditAccountID1: isCreditorCounterparty ? counterpartyId : taxCategory,
          creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyCreditAmount1: Math.abs(amount),
          debitAccountID1: isCreditorCounterparty ? taxCategory : counterpartyId,
          debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
          localCurrencyDebitAmount1: Math.abs(amount),
          description: transaction.source_description ?? undefined,
          reference1: transaction.source_id,
          isCreditorCounterparty,
          ownerId: charge.owner_id,
        });

        if (transaction.debit_date) {
          dates.add(transaction.debit_date);
        }
        currencies.add(currencyCode);
      }
    }

    // Add ledger completion entries
    const miscLedgerEntries: LedgerProto[] = [];
    if (ledgerBalance !== 0) {
      if (charge.is_conversion) {
        throw new GraphQLError('Conversion charges must have a ledger balance');
      }
      if (!accountingLedgerEntries.length) {
        const counterpartyId = financialAccountLedgerEntries[0].isCreditorCounterparty
          ? financialAccountLedgerEntries[0].creditAccountID1
          : financialAccountLedgerEntries[0].debitAccountID1;
        const business = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(
            typeof counterpartyId === 'string' ? counterpartyId : counterpartyId.id,
          );
        if (business?.no_invoices_required) {
          return { records: financialAccountLedgerEntries };
        }
      }

      const hasMultipleDates = dates.size > 1;
      const hasForeignCurrency = currencies.size > (currencies.has('ILS') ? 1 : 0);
      if (hasMultipleDates && hasForeignCurrency) {
        const baseEntry = financialAccountLedgerEntries[0];

        const exchangeCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(EXCHANGE_RATE_CATEGORY_NAME);
        if (!exchangeCategory) {
          throw new GraphQLError(`Tax category "${EXCHANGE_RATE_CATEGORY_NAME}" not found`);
        }

        const amount = Math.abs(ledgerBalance);
        const counterparty =
          typeof baseEntry.creditAccountID1 === 'string'
            ? baseEntry.creditAccountID1
            : baseEntry.debitAccountID1;

        const isCreditorCounterparty = ledgerBalance < 0;

        miscLedgerEntries.push({
          id: baseEntry.id, // NOTE: this field is dummy
          creditAccountID1: isCreditorCounterparty ? counterparty : exchangeCategory,
          creditAmount1: undefined,
          localCurrencyCreditAmount1: amount,
          debitAccountID1: isCreditorCounterparty ? exchangeCategory : counterparty,
          debitAmount1: undefined,
          localCurrencyDebitAmount1: amount,
          description: 'Exchange ledger record',
          isCreditorCounterparty,
          invoiceDate: baseEntry.invoiceDate, // NOTE: this field is dummy
          valueDate: baseEntry.valueDate, // NOTE: this field is dummy
          currency: baseEntry.currency, // NOTE: this field is dummy
          reference1: baseEntry.reference1, // NOTE: this field is dummy
          ownerId: baseEntry.ownerId,
        });
      } else {
        throw new GraphQLError(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${hasForeignCurrency ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    // TODO: validate counterparty is consistent

    return {
      records: [...accountingLedgerEntries, ...financialAccountLedgerEntries, ...miscLedgerEntries],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
