import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { ChargeResolvers, Currency, TaxCategory } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';
import { getRateForCurrency } from '../helpers/exchange.helper.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import type { LedgerModule } from '../types.js';

const generateLedgerRecords: ChargeResolvers['ledgerRecords'] = async (
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

      const isCreditorCounterparty = invoice.debtor_id === charge.owner_id;

      const counterpartyId = isCreditorCounterparty ? invoice.creditor_id : invoice.debtor_id;
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

      const debitAccountID1 = isCreditorCounterparty ? counterpartyTaxCategory : invoice.debtor_id;
      const creditAccountID1 = isCreditorCounterparty
        ? invoice.creditor_id
        : counterpartyTaxCategory;
      let creditAccountID2: TaxCategory | null = null;
      let debitAccountID2: TaxCategory | null = null;

      if (!invoice.total_amount) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing amount`);
      }

      if (!invoice.currency_code) {
        throw new GraphQLError(`Document ID="${invoice.id}" is missing currency code`);
      }
      const currency = formatCurrency(invoice.currency_code);
      let totalAmount = invoice.total_amount;
      let foreignTotalAmount: number | null = null;
      let amountWithoutVat = totalAmount;
      let foreignAmountWithoutVat: number | null = null;
      let vatAmount = invoice.vat_amount;
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
        localCurrencyCreditAmount1 = amountWithoutVat;
        creditAmount1 = foreignAmountWithoutVat;
        localCurrencyDebitAmount1 = totalAmount;
        debitAmount1 = foreignTotalAmount;

        if (vatAmount && vatAmount > 0) {
          // add vat to creditor2
          creditAmount2 = foreignVatAmount;
          localCurrencyCreditAmount2 = vatAmount;
          creditAccountID2 = vatTaxCategory;
        }
      } else {
        localCurrencyDebitAmount1 = amountWithoutVat;
        debitAmount1 = foreignAmountWithoutVat;
        localCurrencyCreditAmount1 = totalAmount;
        creditAmount1 = foreignTotalAmount;

        if (vatAmount && vatAmount > 0) {
          // add vat to creditor2
          debitAmount2 = foreignVatAmount;
          localCurrencyDebitAmount2 = vatAmount;
          debitAccountID2 = vatTaxCategory;
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
      });
    }

    return accountingLedgerEntries;
  } catch (e) {
    throw new GraphQLError(`Failed to generate ledger records for charge ID="${chargeId}"\n${e}`);
  }
};

export const ledgerResolvers: LedgerModule.Resolvers = {
  LedgerRecord: {
    id: () => '',
    debitAmount1: DbLedgerRecord =>
      DbLedgerRecord.debitAmount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debitAmount1, DbLedgerRecord.currency),
    debitAmount2: DbLedgerRecord =>
      DbLedgerRecord.debitAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debitAmount2, DbLedgerRecord.currency),
    creditAmount1: DbLedgerRecord =>
      DbLedgerRecord.creditAmount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.creditAmount1, DbLedgerRecord.currency),
    creditAmount2: DbLedgerRecord =>
      DbLedgerRecord.creditAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.creditAmount2, DbLedgerRecord.currency),
    localCurrencyDebitAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.localCurrencyDebitAmount1, Currency.Ils),
    localCurrencyDebitAmount2: DbLedgerRecord =>
      DbLedgerRecord.localCurrencyDebitAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.localCurrencyDebitAmount2, Currency.Ils),
    localCurrencyCreditAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.localCurrencyCreditAmount1, Currency.Ils),
    localCurrencyCreditAmount2: DbLedgerRecord =>
      DbLedgerRecord.localCurrencyCreditAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.localCurrencyCreditAmount2, Currency.Ils),
    invoiceDate: DbLedgerRecord => DbLedgerRecord.invoiceDate,
    valueDate: DbLedgerRecord => DbLedgerRecord.valueDate,
    description: DbLedgerRecord => DbLedgerRecord.description ?? null,
    reference1: DbLedgerRecord => DbLedgerRecord.reference1 ?? null,
  },
  Charge: {
    ledgerRecords: generateLedgerRecords,
  },
};
