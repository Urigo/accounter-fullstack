import type { Injector } from 'graphql-modules';
import { DECREASED_VAT_RATIO } from '../../../shared/constants.js';
import { formatCurrency, maxTimelessDate } from '../../../shared/helpers/index.js';
import type {
  LedgerProto,
  StrictLedgerProto,
  TimelessDateString,
} from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import {
  validateDocumentAllocation,
  validateDocumentVat,
} from '../../documents/helpers/validate-document.helper.js';
import type { IGetDocumentsByChargeIdResult } from '../../documents/types.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import {
  statementKeyId,
  toCents,
} from '../../transactions/helpers/creditcard-statement-matcher.helper.js';
import { CreditCardStatementsProvider } from '../../transactions/providers/creditcard-statements.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../transactions/types.js';
import { VatProvider } from '../../vat/providers/vat.provider.js';
import { IGetBalanceCancellationByChargesIdsResult } from '../types.js';
import {
  getFinancialAccountTaxCategoryId,
  LedgerError,
  validateTransactionBasicVariables,
  validateTransactionDates,
} from './utils.helper.js';

export async function ledgerEntryFromDocument(
  injector: Injector,
  document: IGetDocumentsByChargeIdResult,
  charge: IGetChargesByIdsResult,
  ownerId: string,
  taxCategoryId: string,
): Promise<StrictLedgerProto> {
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

  const {
    defaultLocalCurrency,
    authorities: { inputVatTaxCategoryId, outputVatTaxCategoryId, propertyOutputVatTaxCategoryId },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

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

  if (vatAmount != null && charge.is_property) {
    vatAmount = vatAmount * DECREASED_VAT_RATIO; // Adjust VAT for property charges
  }

  const isCreditInvoice = document.type === 'CREDIT_INVOICE';
  if (vatAmount) {
    amountWithoutVat = amountWithoutVat - vatAmount;
    const adjustedOutputVatTaxCategoryId = charge.is_property
      ? propertyOutputVatTaxCategoryId
      : outputVatTaxCategoryId;
    vatTaxCategory =
      isCreditorCounterparty === isCreditInvoice
        ? inputVatTaxCategoryId
        : adjustedOutputVatTaxCategoryId;

    const vatValue = await injector.get(VatProvider).getVatValueByDateLoader.load(document.date);

    if (!vatValue) {
      throw new LedgerError(`VAT value is missing for document ID=${document.id}`);
    }

    validateDocumentVat(document, vatValue, message => {
      throw new LedgerError(message);
    });
    await validateDocumentAllocation(document, injector).then(valid => {
      if (!valid) {
        throw new LedgerError(`Allocation number missing for document [${document.serial_number}]`);
      }
    });
  }

  // handle non-local currencies
  if (document.currency_code !== defaultLocalCurrency) {
    let exchangeRate: number;
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
  let creditAmount1: number | null;
  let localCurrencyCreditAmount1: number;
  let debitAmount1: number | null;
  let localCurrencyDebitAmount1: number;
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
    chargeId: charge.id,
  };

  return ledgerEntry;
}

/** One booking of a bank transaction: the account it is booked against and its signed amount */
type MainTransactionPart = {
  counterAccountId: string;
  /** Signed, in the transaction currency */
  amount: number;
};

/**
 * Books a transaction as one entry per part, all at the transaction's dates and exchange rate. The
 * transaction's own financial account is the other side of every entry.
 */
async function ledgerEntriesFromTransactionParts(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
  chargeId: string,
  ownerId: string,
  parts: readonly MainTransactionPart[],
): Promise<StrictLedgerProto[]> {
  const { currency, valueDate, exchangeRateDate } = validateTransactionDates(transaction);

  const { defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();

  // one rate for every part: they all settle at the transaction's own date
  const exchangeRate =
    currency === defaultLocalCurrency
      ? null
      : await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultLocalCurrency, exchangeRateDate);

  const accountTaxCategoryId = await getFinancialAccountTaxCategoryId(injector, transaction);

  return parts.map(part => {
    let amount = part.amount;
    let foreignAmount: number | undefined = undefined;
    if (exchangeRate !== null) {
      foreignAmount = amount;
      // calculate amounts in ILS
      amount = exchangeRate * amount;
    }

    const isCreditorCounterparty = amount > 0;

    return {
      id: transaction.id,
      invoiceDate: transaction.event_date,
      valueDate,
      exchangeRateDate,
      currency,
      creditAccountID1: isCreditorCounterparty ? part.counterAccountId : accountTaxCategoryId,
      creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
      localCurrencyCreditAmount1: Math.abs(amount),
      debitAccountID1: isCreditorCounterparty ? accountTaxCategoryId : part.counterAccountId,
      debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
      localCurrencyDebitAmount1: Math.abs(amount),
      description: transaction.source_description ?? undefined,
      reference: transaction.origin_key,
      isCreditorCounterparty,
      ownerId,
      currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
      chargeId,
    };
  });
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * The parts of a bank transaction with stored card statement links, or `null` when it has none.
 * Each linked statement is booked against its card account. A single statement takes the whole
 * transaction amount; several statements each take their card total, which must add up to the
 * transaction amount exactly.
 */
async function linkedStatementParts(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
): Promise<MainTransactionPart[] | null> {
  const provider = injector.get(CreditCardStatementsProvider);
  const links = (await provider.getLinksByBankTransactionIdLoader.load(transaction.id)).filter(
    link => link.owner_id === transaction.owner_id,
  );
  if (links.length === 0) {
    return null;
  }
  const foreignCurrencyLink = links.find(link => link.currency !== transaction.currency);
  if (foreignCurrencyLink) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}": a linked card statement is in ${foreignCurrencyLink.currency} but the debit is in ${transaction.currency}; fix the links`,
    );
  }

  const counterAccountIds = await Promise.all(
    links.map(link =>
      getFinancialAccountTaxCategoryId(injector, {
        ...transaction,
        account_id: link.card_account_id,
      }),
    ),
  );

  if (links.length === 1) {
    return [{ counterAccountId: counterAccountIds[0], amount: Number(transaction.amount) }];
  }

  const statementTotalsCents = await Promise.all(
    links.map(async link => {
      const rows = await provider.getCardTransactionsByStatementKeyLoader.load(
        statementKeyId({
          cardAccountId: link.card_account_id,
          currency: link.currency,
          debitDate: link.debit_date,
        }),
      );
      return rows
        .filter(row => row.owner_id === transaction.owner_id)
        .reduce((sum, row) => sum + toCents(row.amount), 0);
    }),
  );
  const linkedCents = statementTotalsCents.reduce((sum, total) => sum + total, 0);
  const bankCents = toCents(transaction.amount);
  if (linkedCents !== bankCents) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}": linked card statements total ${formatCents(linkedCents)} but the debit is ${formatCents(bankCents)}; fix the links`,
    );
  }

  return links
    .map((_link, index) => ({
      counterAccountId: counterAccountIds[index],
      amount: statementTotalsCents[index] / 100,
    }))
    .filter(part => part.amount !== 0);
}

/**
 * Books a charge's main (non-fee) transaction. A single entry, against the transaction's
 * counterparty; or, for a card debit into an internal wallet without relevant documents, against
 * the financial account numbered as the transaction's reference.
 *
 * Does not read stored card statement links: the common charge generator books those with
 * `ledgerEntriesFromMainTransaction`.
 */
export async function ledgerEntryFromMainTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
  chargeId: string,
  ownerId: string,
  businessId?: string,
  gotRelevantDocuments = false,
): Promise<StrictLedgerProto> {
  const { transactionBusinessId } = validateTransactionBasicVariables(transaction);

  let mainAccountId: string = transactionBusinessId;

  const {
    financialAccounts: { internalWalletsIds, creditCardIds },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

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
      // a card debit that names no card account: it needs a stored link to its card statement
      const linkHint = creditCardIds.includes(businessId)
        ? `: link the debit to its card statement in the charge's CreditCard Transactions panel`
        : '';
      throw new LedgerError(
        `Transaction reference "${transaction.source_reference}" is missing account${linkHint}`,
      );
    }
    mainAccountId = await getFinancialAccountTaxCategoryId(injector, {
      ...transaction,
      account_id: account.id,
    });
  }

  const [ledgerEntry] = await ledgerEntriesFromTransactionParts(
    transaction,
    injector,
    chargeId,
    ownerId,
    [{ counterAccountId: mainAccountId, amount: Number(transaction.amount) }],
  );
  return ledgerEntry;
}

/**
 * Books a charge's main (non-fee) transaction for the common charge generator.
 *
 * A bank transaction with stored card statement links and no relevant documents is booked against
 * the linked card accounts, one entry per linked statement; it needs no counterparty business.
 * Anything else is booked as `ledgerEntryFromMainTransaction` books it.
 */
export async function ledgerEntriesFromMainTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
  injector: Injector,
  chargeId: string,
  ownerId: string,
  businessId?: string,
  gotRelevantDocuments = false,
): Promise<StrictLedgerProto[]> {
  if (!gotRelevantDocuments) {
    const parts = await linkedStatementParts(transaction, injector);
    if (parts) {
      return ledgerEntriesFromTransactionParts(transaction, injector, chargeId, ownerId, parts);
    }
  }

  return [
    await ledgerEntryFromMainTransaction(
      transaction,
      injector,
      chargeId,
      ownerId,
      businessId,
      gotRelevantDocuments,
    ),
  ];
}

export async function ledgerEntryFromBalanceCancellation(
  balanceCancellation: IGetBalanceCancellationByChargesIdsResult,
  ledgerBalance: Map<string, { amount: number; entityId: string }>,
  financialAccountLedgerEntries: StrictLedgerProto[],
  chargeId: string,
  ownerId: string,
  injector: Injector,
): Promise<LedgerProto> {
  const {
    defaultLocalCurrency,
    general: {
      taxCategories: { balanceCancellationTaxCategoryId },
    },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
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

export function getExchangeDates(financialAccountLedgerEntries: LedgerProto[]): TimelessDateString {
  return maxTimelessDate(...financialAccountLedgerEntries.map(entry => entry.valueDate))!;
}
