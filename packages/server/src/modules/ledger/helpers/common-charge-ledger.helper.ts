import {
  validateDocumentAllocation,
  validateDocumentVat,
} from '@modules/documents/helpers/validate-document.helper.js';
import type { IGetDocumentsByChargeIdResult } from '@modules/documents/types';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { VatProvider } from '@modules/vat/providers/vat.provider.js';
import { dateToTimelessDateString, formatCurrency } from '@shared/helpers';
import type { LedgerProto, StrictLedgerProto } from '../../../shared/types/index.js';
import { IGetBalanceCancellationByChargesIdsResult } from '../types.js';
import {
  getFinancialAccountTaxCategoryId,
  LedgerError,
  validateTransactionBasicVariables,
} from './utils.helper.js';

export async function ledgerEntryFromDocument(
  document: IGetDocumentsByChargeIdResult,
  context: GraphQLModules.Context,
  chargeId: string,
  ownerId: string,
  taxCategoryId: string,
): Promise<StrictLedgerProto> {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      authorities: { inputVatTaxCategoryId, outputVatTaxCategoryId },
    },
  } = context;
  if (!document.date) {
    throw new LedgerError(`Document serial "${document.serial_number}" is missing the date`);
  }

  if (!document.debtor_id) {
    throw new LedgerError(`Document serial "${document.serial_number}" is missing the debtor`);
  }
  if (!document.creditor_id) {
    throw new LedgerError(`Document serial "${document.serial_number}" is missing the creditor`);
  }
  if (!document.total_amount) {
    throw new LedgerError(`Document serial "${document.serial_number}" is missing amount`);
  }
  if (!document.currency_code) {
    throw new LedgerError(`Document serial "${document.serial_number}" is missing currency code`);
  }

  let totalAmount = Math.abs(document.total_amount);

  const isCreditorCounterparty = document.debtor_id === ownerId;
  const counterpartyId = isCreditorCounterparty ? document.creditor_id : document.debtor_id;

  const debitAccountID1 = isCreditorCounterparty ? taxCategoryId : counterpartyId;
  const creditAccountID1 = isCreditorCounterparty ? counterpartyId : taxCategoryId;

  const currency = formatCurrency(document.currency_code);
  let foreignTotalAmount: number | null = null;
  let amountWithoutVat = totalAmount;
  let foreignAmountWithoutVat: number | null = null;
  let vatAmount = document.vat_amount == null ? null : Math.abs(document.vat_amount);
  let foreignVatAmount: number | null = null;
  let vatTaxCategory: string | null = null;

  const isCreditInvoice = document.type === 'CREDIT_INVOICE';
  if (vatAmount) {
    amountWithoutVat = amountWithoutVat - vatAmount;
    vatTaxCategory =
      isCreditorCounterparty === isCreditInvoice ? inputVatTaxCategoryId : outputVatTaxCategoryId;

    const vatValue = await injector
      .get(VatProvider)
      .getVatValueByDateLoader.load(dateToTimelessDateString(document.date));

    if (!vatValue) {
      throw new LedgerError(`VAT value is missing for document ID=${document.id}`);
    }

    validateDocumentVat(document, vatValue, message => {
      throw new LedgerError(message);
    });
    await validateDocumentAllocation(document, context).then(valid => {
      if (!valid) {
        throw new LedgerError(`Allocation number missing for document [${document.serial_number}]`);
      }
    });
  }

  // handle non-local currencies
  if (document.currency_code !== defaultLocalCurrency) {
    let exchangeRate = 1;
    if (document.exchange_rate_override) {
      exchangeRate = Number(document.exchange_rate_override);
    } else {
      exchangeRate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(currency, defaultLocalCurrency, document.date);
    }

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

  let creditAccountID2: string | null = null;
  let debitAccountID2: string | null = null;
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
    description: undefined,
    reference: document.serial_number ?? undefined,
    isCreditorCounterparty,
    isCreditInvoice,
    ownerId,
    chargeId,
  };

  return ledgerEntry;
}

export async function ledgerEntryFromMainTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
  context: GraphQLModules.Context,
  chargeId: string,
  ownerId: string,
  businessId?: string,
  gotRelevantDocuments = false,
): Promise<StrictLedgerProto> {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      financialAccounts: { internalWalletsIds },
    },
  } = context;
  const { currency, valueDate, transactionBusinessId } =
    validateTransactionBasicVariables(transaction);

  let mainAccountId: string = transactionBusinessId;

  if (
    !gotRelevantDocuments &&
    transaction.source_reference &&
    businessId &&
    internalWalletsIds.includes(businessId)
  ) {
    const account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountNumberLoader.load(transaction.source_reference);
    if (!account) {
      throw new LedgerError(
        `Transaction reference "${transaction.source_reference}" is missing account`,
      );
    }
    mainAccountId = await getFinancialAccountTaxCategoryId(injector, {
      ...transaction,
      account_id: account.id,
    });
  }

  let amount = Number(transaction.amount);
  let foreignAmount: number | undefined = undefined;

  if (currency !== defaultLocalCurrency) {
    // get exchange rate for currency
    const exchangeRate = await injector
      .get(ExchangeProvider)
      .getExchangeRates(currency, defaultLocalCurrency, valueDate);

    foreignAmount = amount;
    // calculate amounts in ILS
    amount = exchangeRate * amount;
  }

  const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

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
    reference: transaction.origin_key,
    isCreditorCounterparty,
    ownerId,
    currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
    chargeId,
  };

  return ledgerEntry;
}

export function ledgerEntryFromBalanceCancellation(
  balanceCancellation: IGetBalanceCancellationByChargesIdsResult,
  ledgerBalance: Map<string, { amount: number; entityId: string }>,
  financialAccountLedgerEntries: StrictLedgerProto[],
  chargeId: string,
  ownerId: string,
  context: GraphQLModules.Context,
): LedgerProto {
  const {
    adminContext: {
      defaultLocalCurrency,
      general: {
        taxCategories: { balanceCancellationTaxCategoryId },
      },
    },
  } = context;
  const entityBalance = ledgerBalance.get(balanceCancellation.business_id);
  if (!entityBalance) {
    throw new LedgerError(
      `Balance cancellation for business ${balanceCancellation.business_id} redundant - already balanced`,
    );
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
    throw new LedgerError(
      `Balance cancellation for business ${balanceCancellation.business_id} failed - no financial account entry found`,
    );
  }

  let foreignAmount: number | undefined = undefined;

  if (
    financialAccountEntry.currency !== defaultLocalCurrency &&
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
    creditAccountID1: isCreditorCounterparty ? balanceCancellationTaxCategoryId : entityId,
    creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
    localCurrencyCreditAmount1: Math.abs(amount),
    debitAccountID1: isCreditorCounterparty ? entityId : balanceCancellationTaxCategoryId,
    debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
    localCurrencyDebitAmount1: Math.abs(amount),
    description: balanceCancellation.description ?? undefined,
    reference: financialAccountEntry.reference,
    isCreditorCounterparty,
    ownerId,
    currencyRate: financialAccountEntry.currencyRate,
    chargeId,
  };

  return ledgerEntry;
}

export function isRefundCharge(description?: string | null): boolean {
  if (!description) {
    return false;
  }
  const normalizedDescription = description.toLocaleLowerCase();
  return (
    normalizedDescription.includes('refund') || normalizedDescription.includes('reimbursement')
  );
}

export function getExchangeDates(financialAccountLedgerEntries: LedgerProto[]): Date {
  const timeValue = Math.max(
    ...financialAccountLedgerEntries.map(entry => entry.valueDate.getTime()),
  );
  const date = new Date(timeValue);

  return date;
}
