import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { currency } from '@modules/transactions/types.js';
import { ChargeResolvers, TaxCategory } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';
import { getRateForCurrency } from '../helpers/exchange.helper.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';

export const generateLedgerRecords: ChargeResolvers['ledgerRecords'] = async (
  DbCharge,
  _,
  { injector },
) => {
  const chargeId = DbCharge.id;

  try {
    const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
    if (!charge) {
      throw new GraphQLError(`Charge ID="${chargeId}" not found`);
    }

    const accountingLedgerEntries: LedgerProto[] = [];

    // Get all invoices for charge
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByChargeIdLoader.load(chargeId);
    const invoices = documents.filter(d => ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type));

    // validate ledger records are balanced
    let ledgerBalance = 0;

    // for each invoice - generate accounting ledger entry
    for (const invoice of invoices) {
      if (!invoice.date) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing the date`);
      }

      if (!invoice.debtor_id) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing the debtor`);
      }
      if (!invoice.creditor_id) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing the creditor`);
      }
      if (!invoice.total_amount) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing amount`);
      }
      let totalAmount = invoice.total_amount;

      const isCreditorCounterparty = invoice.debtor_id === charge.owner_id;
      const counterpartyId = isCreditorCounterparty ? invoice.creditor_id : invoice.debtor_id;
      if (totalAmount < 0) {
        totalAmount = Math.abs(totalAmount);
      }

      const taxCategoryInfo = await injector
        .get(TaxCategoriesProvider)
        .getFinancialEntityByNameLoader.load({
          ownerID: charge.owner_id,
          businessID: counterpartyId,
        });
      if (!taxCategoryInfo) {
        throw new GraphQLError(`Tax category not found for counterparty ID="${counterpartyId}"`);
      }
      const counterpartyTaxCategory: TaxCategory = {
        id: taxCategoryInfo.id,
        name: taxCategoryInfo.name!,
        __typename: 'TaxCategory',
      };

      const debitAccountID1 = isCreditorCounterparty ? counterpartyTaxCategory : counterpartyId;
      const creditAccountID1 = isCreditorCounterparty ? counterpartyId : counterpartyTaxCategory;
      let creditAccountID2: TaxCategory | null = null;
      let debitAccountID2: TaxCategory | null = null;

      if (!invoice.currency_code) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing currency code`);
      }
      const currency = formatCurrency(invoice.currency_code);
      let foreignTotalAmount: number | null = null;
      let amountWithoutVat = totalAmount;
      let foreignAmountWithoutVat: number | null = null;
      let vatAmount = invoice.vat_amount == null ? null : Math.abs(invoice.vat_amount);
      let foreignVatAmount: number | null = null;
      let vatTaxCategory: TaxCategory | null = null;

      if (vatAmount && vatAmount > 0) {
        amountWithoutVat = amountWithoutVat - vatAmount;
        // TODO(Gil): Use real tax category
        vatTaxCategory = {
          id: charge.id,
          name: 'VAT [temp]',
          __typename: 'TaxCategory',
        };
      }

      // handle non-local currencies
      if (invoice.currency_code !== 'ILS') {
        // get exchange rate for currency
        const exchangeRates = await injector.get(ExchangeProvider).getExchangeRates(invoice.date);
        const exchangeRate = getRateForCurrency(invoice.currency_code, exchangeRates);

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
        id: invoice.id,
        invoiceDate: invoice.date,
        valueDate: invoice.date,
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
        description: invoice.description ?? undefined,
        reference1: invoice.serial_number ?? undefined,
        isCreditorCounterparty,
      });

      if (isCreditorCounterparty) {
        ledgerBalance += totalAmount;
      } else {
        ledgerBalance -= totalAmount;
      }
    }

    const financialAccountLedgerEntries: LedgerProto[] = [];

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

      // NOTE: owner is hard coded here, should later be fetched from DB
      const owner = {
        id: transaction.account_id,
        name: `Account ID:...${transaction.account_id.slice(-6)}`,
        __typename: 'TaxCategory',
      } as TaxCategory;

      const isCreditorCounterparty = amount > 0;

      ledgerBalance += amount;

      const currency = formatCurrency(currencyCode);

      financialAccountLedgerEntries.push({
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate: transaction.debit_date,
        currency,
        creditAccountID1: isCreditorCounterparty ? counterpartyId : owner,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? owner : counterpartyId,
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty,
      });
    }

    // Add ledger completion entries
    const miscLedgerEntries: LedgerProto[] = [];
    if (ledgerBalance !== 0) {
      if (!accountingLedgerEntries.length) {
        const counterpartyId = financialAccountLedgerEntries[0].isCreditorCounterparty
          ? financialAccountLedgerEntries[0].creditAccountID1
          : financialAccountLedgerEntries[0].debitAccountID1;
        const business = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(counterpartyId as string);
        if (business?.no_invoices_required) {
          return { records: financialAccountLedgerEntries };
        }
      }
      const dates = new Set<Date>(
        [...documents.map(doc => doc.date), ...transactions.map(t => t.debit_date)].filter(
          Boolean,
        ) as Date[],
      );
      const currencies = new Set<currency>(
        [...documents.map(doc => doc.currency_code), ...transactions.map(t => t.currency)].filter(
          Boolean,
        ) as currency[],
      );

      const hasMultipleDates = dates.size > 1;
      const hasForeignCurrency = currencies.size > 1;
      if (hasMultipleDates && hasForeignCurrency) {
        const baseEntry = financialAccountLedgerEntries[0];
        // NOTE: exchangeCategory is hard coded here, should later be fetched from DB
        const exchangeCategory = {
          id: baseEntry.id, // NOTE: this field is dummy
          name: 'Exchange',
          __typename: 'TaxCategory',
        } as TaxCategory;

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
        });

        // currencies.delete('ILS');
        // if (currencies.size > 1) {
        //   throw new GraphQLError(
        //     `Ledger records for charge ${chargeId} are not balanced, and has multiple foreign currencies`,
        //   );
        // }
        // const currency = [...currencies][0];
        // // calculate foreign balance
        // let foreignBalance = 0;
        // for (const entry of accountingLedgerEntries) {
        //   const isCreditorCounterparty = !!entry.debitAccountID2;
        //   let foreignAmount = isCreditorCounterparty ? entry.creditAmount1 : entry.debitAmount1;
        //   if (foreignAmount == null) {
        //     const exchangeRates = await injector
        //       .get(ExchangeProvider)
        //       .getExchangeRates(entry.invoiceDate);
        //     const exchangeRate = getRateForCurrency(currency, exchangeRates);
        //     foreignAmount =
        //       (isCreditorCounterparty
        //         ? entry.localCurrencyCreditAmount1
        //         : entry.localCurrencyDebitAmount1) / exchangeRate;
        //   }
        //   foreignBalance += foreignAmount * (entry.isCreditorCounterparty ? 1 : -1);
        // }
        // for (const entry of financialAccountLedgerEntries) {
        //   // amounts are the same on both sides for transactions, so it doesn't matter which is the counterparty
        //   let foreignAmount = entry.creditAmount1;
        //   if (foreignAmount == null) {
        //     const exchangeRates = await injector
        //       .get(ExchangeProvider)
        //       .getExchangeRates(entry.invoiceDate);
        //     const exchangeRate = getRateForCurrency(currency, exchangeRates);
        //     foreignAmount = entry.localCurrencyCreditAmount1 / exchangeRate;
        //   }
        //   foreignBalance += foreignAmount * (entry.isCreditorCounterparty ? 1 : -1);
        // }
        // if (foreignBalance === 0) {
        //   throw new GraphQLError(`Yay! we are balanced!`);
        //   // TODO: add exchange rate ledger
        // } else {
        //   throw new GraphQLError(
        //     `Failed to balance ledger records for charge ID="${chargeId}": both local and foreign amounts won't balance`,
        //   );
        // }
      } else {
        throw new GraphQLError(
          `Failed to balance: ${
            hasMultipleDates ? 'Dates are different' : 'Dates are consistent'
          } and ${hasForeignCurrency ? 'currencies are foreign' : 'currencies are local'}`,
        );
      }
    }

    // validate counterparty is consistent

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
