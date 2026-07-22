import { Injector } from 'graphql-modules';
import type { FinancialAmount } from '../../../__generated__/types.js';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { isInvoice, isReceipt } from '../../documents/helpers/common.helper.js';
import { basicDocumentValidation } from '../../documents/helpers/validate-document.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { getLedgerMeta } from '../../ledger/helpers/common.helper.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { getTransactionsMeta } from '../../transactions/helpers/common.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { IGetChargesByFiltersResult, IGetChargesByIdsResult } from '../types.js';

/**
 * Charge reference accepted by the meta helpers: a charge id (resolved via the
 * by-id loader) or an already-loaded charge row. Passing the row from
 * `getChargesByFilters` unlocks the enriched fast path — the aggregates were
 * already computed by that query, so no child-table loads are needed.
 */
export type ChargeRef = string | IGetChargesByIdsResult;

/**
 * Whether this charge row came from `getChargesByFilters` and carries the
 * precomputed per-charge aggregates. `abs_event_amount` is selected only by
 * that query, so it doubles as the marker. The `js_*`-derived columns mirror
 * the JS meta helpers exactly (fee-aware amounts, debit_timestamp-based dates,
 * debtor-sign document sums), so serving them from the row is
 * behavior-preserving.
 */
export function isEnrichedFilteredCharge(
  charge: IGetChargesByIdsResult,
): charge is IGetChargesByIdsResult & IGetChargesByFiltersResult {
  return 'abs_event_amount' in charge;
}

async function resolveCharge(
  chargeRef: ChargeRef,
  injector: Injector,
): Promise<IGetChargesByIdsResult> {
  if (typeof chargeRef !== 'string') {
    return chargeRef;
  }
  const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeRef);
  if (!charge) {
    throw new Error(`Charge ID="${chargeRef}" not found`);
  }
  return charge;
}

export async function calculateTotalAmount(
  chargeRef: ChargeRef,
  injector: Injector,
  defaultLocalCurrency: Currency,
): Promise<FinancialAmount | null> {
  try {
    const charge = await resolveCharge(chargeRef, injector);
    const [{ transactionsAmount, transactionsCurrency }, { documentsCurrency, documentsAmount }] =
      await Promise.all([
        getChargeTransactionsMeta(charge, injector),
        getChargeDocumentsMeta(charge, injector),
      ]);

    if (charge.type === 'PAYROLL' && transactionsAmount) {
      return formatFinancialAmount(transactionsAmount, defaultLocalCurrency);
    }
    if (documentsAmount && documentsCurrency) {
      return formatFinancialAmount(documentsAmount, documentsCurrency);
    }
    if (transactionsAmount && transactionsCurrency) {
      return formatFinancialAmount(transactionsAmount, transactionsCurrency);
    }
    return null;
  } catch (error) {
    console.error('Error calculating total amount for charge:', error);
    throw new Error('Failed to calculate total amount for charge', { cause: error });
  }
}

export async function getChargeBusinesses(chargeRef: ChargeRef, injector: Injector) {
  const charge = await resolveCharge(chargeRef, injector);

  if (isEnrichedFilteredCharge(charge)) {
    // business_array folds in transactions, documents, ledger and misc-expense
    // parties (minus the owner), so no child-table loads are needed.
    return {
      allBusinessIds: charge.business_array ?? [],
      mainBusinessId: (charge.business_id as string | null) ?? null,
    };
  }

  const [transactions, documents, ledgerRecords, miscExpenses] = await Promise.all([
    injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(charge.id),
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(charge.id),
    injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(charge.id),
    injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(charge.id),
  ]);

  const allBusinessIdsSet = new Set<string>();
  const mainBusinessIdsSet = new Set<string>();

  transactions.map(t => {
    if (t.business_id) {
      allBusinessIdsSet.add(t.business_id);
      if (!t.is_fee) {
        mainBusinessIdsSet.add(t.business_id);
      }
    }
  });

  documents.map(d => {
    [d.creditor_id, d.debtor_id].map(id => {
      if (id && id !== charge.owner_id) {
        allBusinessIdsSet.add(id);
        mainBusinessIdsSet.add(id);
      }
    });
  });

  ledgerRecords.map(lr => {
    [lr.credit_entity1, lr.credit_entity2, lr.debit_entity1, lr.debit_entity2].map(id => {
      if (id && id !== charge.owner_id) {
        allBusinessIdsSet.add(id);
      }
    });
  });

  miscExpenses.map(me => {
    [me.creditor_id, me.debtor_id].map(id => {
      if (id && id !== charge.owner_id) {
        allBusinessIdsSet.add(id);
      }
    });
  });

  const allBusinessIds = Array.from(allBusinessIdsSet);
  const mainBusinessIds = Array.from(mainBusinessIdsSet);

  let mainBusinessId: string | null = null;

  if (mainBusinessIds.length === 1) {
    mainBusinessId = mainBusinessIds[0];
  }

  return {
    allBusinessIds,
    mainBusinessId,
  };
}

export async function getChargeDocumentsMeta(chargeRef: ChargeRef, injector: Injector) {
  const charge = await resolveCharge(chargeRef, injector);

  if (isEnrichedFilteredCharge(charge)) {
    const invoiceCount = Number(charge.invoices_count ?? 0);
    const receiptCount = Number(charge.receipts_count ?? 0);
    const invoiceAmount = charge.documents_invoice_amount ?? 0;
    const receiptAmount = charge.documents_receipt_amount ?? 0;
    const proformaAmount = charge.documents_proforma_amount;
    const accountancyCurrencies = (charge.documents_accountancy_currencies ?? []) as Currency[];
    const proformaCurrencies = (charge.documents_proforma_currencies ?? []) as Currency[];
    const currencies =
      accountancyCurrencies.length > 0 ? accountancyCurrencies : proformaCurrencies;
    const documentsAmount =
      invoiceCount > 0 ? invoiceAmount : receiptCount > 0 ? receiptAmount : proformaAmount;

    return {
      receiptAmount,
      receiptCount,
      invoiceAmount,
      invoiceCount,
      documentsAmount,
      documentsVatAmount:
        charge.documents_invoice_vat_amount ?? charge.documents_receipt_vat_amount,
      documentsCount: Number(charge.documents_count ?? 0),
      documentsCurrency: currencies.length === 1 ? currencies[0] : null,
      // SQL semantics differ slightly from basicDocumentValidation (VAT required
      // for receipts, proforma not validated); validateCharge derives its own
      // value from the loaded documents where exactness matters.
      invalidDocuments: charge.invalid_documents ?? false,
      documentsMinDate: charge.documents_min_date,
      documentsMaxDate: charge.documents_max_date,
    };
  }

  const documents = await injector
    .get(DocumentsProvider)
    .getDocumentsByChargeIdLoader.load(charge.id);

  let invalidDocuments = false;
  let receiptAmount = 0;
  let receiptVatAmount: number | null = null;
  let receiptCount = 0;
  let invoiceAmount = 0;
  let invoiceVatAmount: number | null = null;
  let invoiceCount = 0;
  let proformaAmount: number | null = null;
  const currenciesSet = new Set<Currency>();
  const proformaCurrencySet = new Set<Currency>();
  let documentsMinAccountancyDate: Date | null = null;
  let documentsMinAnyDate: Date | null = null;
  let documentsMaxAccountancyDate: Date | null = null;
  let documentsMaxDate: Date | null = null;

  documents.map(d => {
    const amount = d.total_amount ?? 0;
    let factor = 1;
    if (d.debtor_id === charge.owner_id) {
      factor *= -1;
    }

    if (d.date) {
      documentsMinAnyDate ??= d.date;
      if (documentsMinAnyDate > d.date) {
        documentsMinAnyDate = d.date;
      }

      documentsMaxDate ??= d.date;
      if (documentsMaxDate < d.date) {
        documentsMaxDate = d.date;
      }
    }

    if (isInvoice(d.type)) {
      invoiceCount++;
      invoiceAmount += amount * factor;
      if (d.vat_amount != null) {
        invoiceVatAmount ??= 0;
        invoiceVatAmount += (d.vat_amount ?? 0) * factor;
      }
      if (d.date) {
        documentsMinAccountancyDate ??= d.date;
        if (documentsMinAccountancyDate > d.date) {
          documentsMinAccountancyDate = d.date;
        }

        documentsMaxAccountancyDate ??= d.date;
        if (documentsMaxAccountancyDate < d.date) {
          documentsMaxAccountancyDate = d.date;
        }
      }
      if (d.currency_code) {
        currenciesSet.add(d.currency_code as Currency);
      }
    }
    if (isReceipt(d.type)) {
      receiptCount++;
      receiptAmount += amount * factor;
      if (d.vat_amount != null) {
        receiptVatAmount ??= 0;
        receiptVatAmount += (d.vat_amount ?? 0) * factor;
      }
      if (d.date) {
        documentsMinAccountancyDate ??= d.date;
        if (documentsMinAccountancyDate > d.date) {
          documentsMinAccountancyDate = d.date;
        }

        documentsMaxAccountancyDate ??= d.date;
        if (documentsMaxAccountancyDate < d.date) {
          documentsMaxAccountancyDate = d.date;
        }
      }
      if (d.currency_code) {
        currenciesSet.add(d.currency_code as Currency);
      }
    }
    if (d.type === DocumentType.Proforma) {
      proformaAmount ??= 0;
      proformaAmount += amount * factor;

      if (d.currency_code) {
        proformaCurrencySet.add(d.currency_code as Currency);
      }
    }

    if (!basicDocumentValidation(d)) {
      invalidDocuments = true;
    }
  });

  const currencies =
    currenciesSet.size > 0 ? Array.from(currenciesSet) : Array.from(proformaCurrencySet);
  const documentsAmount =
    invoiceCount > 0 ? invoiceAmount : receiptCount > 0 ? receiptAmount : proformaAmount;

  return {
    receiptAmount,
    receiptCount,
    invoiceAmount,
    invoiceCount,
    documentsAmount,
    documentsVatAmount: invoiceVatAmount ?? receiptVatAmount,
    documentsCount: documents.length,
    documentsCurrency: currencies.length === 1 ? currencies[0] : null,
    invalidDocuments,
    documentsMinDate: documentsMinAccountancyDate ?? (documentsMinAnyDate as Date | null),
    documentsMaxDate: documentsMaxAccountancyDate ?? (documentsMaxDate as Date | null),
  };
}

export async function getChargeTransactionsMeta(chargeRef: ChargeRef, injector: Injector) {
  if (typeof chargeRef !== 'string' && isEnrichedFilteredCharge(chargeRef)) {
    const currencies = (chargeRef.transactions_fee_excluded_currencies ?? []) as Currency[];
    return {
      transactionsCount: Number(chargeRef.transactions_count ?? 0),
      transactionsAmount:
        chargeRef.transactions_fee_excluded_amount == null
          ? null
          : Number(chargeRef.transactions_fee_excluded_amount),
      transactionsCurrencies: currencies,
      transactionsCurrency: currencies.length === 1 ? currencies[0] : null,
      invalidTransactions: chargeRef.invalid_transactions ?? false,
      transactionsMinDebitDate: chargeRef.transactions_min_debit_timestamp,
      transactionsMinEventDate: chargeRef.transactions_min_event_date,
      transactionsMaxDebitDate: chargeRef.transactions_max_debit_timestamp,
      transactionsMaxEventDate: chargeRef.transactions_max_event_date,
    };
  }

  const chargeId = typeof chargeRef === 'string' ? chargeRef : chargeRef.id;
  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(chargeId);

  return getTransactionsMeta(transactions);
}

export async function getChargeLedgerMeta(chargeRef: ChargeRef, injector: Injector) {
  if (typeof chargeRef !== 'string' && isEnrichedFilteredCharge(chargeRef)) {
    return {
      ledgerMinValueDate: chargeRef.ledger_min_value_date,
      ledgerMinInvoiceDate: chargeRef.ledger_min_invoice_date,
      ledgerMaxValueDate: chargeRef.ledger_max_value_date,
      ledgerMaxInvoiceDate: chargeRef.ledger_max_invoice_date,
    };
  }

  const chargeId = typeof chargeRef === 'string' ? chargeRef : chargeRef.id;
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByChargesIdLoader.load(chargeId);

  return getLedgerMeta(ledgerRecords);
}

export async function getChargeTaxCategoryId(
  chargeRef: ChargeRef,
  injector: Injector,
): Promise<string | null> {
  const charge = await resolveCharge(chargeRef, injector);
  if (charge.tax_category_id) {
    return charge.tax_category_id;
  }

  // The filters query already coalesces the business tax-category match into
  // tax_category_id, so a null here means there is genuinely none to derive.
  if (isEnrichedFilteredCharge(charge)) {
    return null;
  }

  const { mainBusinessId } = await getChargeBusinesses(charge, injector);

  if (!mainBusinessId) {
    return null;
  }

  const taxCategory = await injector
    .get(TaxCategoriesProvider)
    .taxCategoryByBusinessIDsLoader.load(mainBusinessId);

  return taxCategory?.id ?? null;
}
