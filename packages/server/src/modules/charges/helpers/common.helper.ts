import { Injector } from 'graphql-modules';
import type { FinancialAmount } from '../../../__generated__/types.js';
import { Currency, DocumentType } from '../../../shared/enums.js';
import {
  formatFinancialAmount,
  maxTimelessDate,
  minTimelessDate,
  optionalDateToTimelessDateString,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { isInvoice, isReceipt } from '../../documents/helpers/common.helper.js';
import { basicDocumentValidation } from '../../documents/helpers/validate-document.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { pruneOffsettingSecurityCandidates } from '../../foreign-securities/helpers/securities-counterparty.helper.js';
import { ForeignSecuritiesProvider } from '../../foreign-securities/providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../../foreign-securities/providers/security-businesses.provider.js';
import { getLedgerMeta } from '../../ledger/helpers/common.helper.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import {
  getTransactionsMeta,
  type TransactionsMeta,
} from '../../transactions/helpers/common.helper.js';
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

type MainBusinesses = {
  /** Main-counterparty candidates; more than one means the charge has no single counterparty */
  mainBusinessIds: string[];
  /** Securities dropped from the candidates because their trades cancel out within the charge */
  offsettingBusinessIds: string[];
  /**
   * More than one candidate is left, and every one of them is a traded security: the charge spans
   * several securities and validly has no single counterparty.
   */
  spansSeveralSecurities: boolean;
};

/**
 * Narrows ambiguous main-counterparty candidates by dropping securities whose trades cancel out
 * within the charge (see `pruneOffsettingSecurityCandidates`). Only charges with a securities
 * candidate pay for the lookup.
 *
 * "Security" means a per-security business only. The tenant's general foreign-securities business
 * stands for a trade whose security was not recognized, which is a gap to surface rather than a
 * counterparty to settle on.
 */
async function narrowMainBusinessIds(
  chargeId: string,
  candidateIds: string[],
  injector: Injector,
  loadedTransactions?: Awaited<
    ReturnType<TransactionsProvider['transactionsByChargeIDLoader']['load']>
  >,
): Promise<MainBusinesses> {
  const unchanged = {
    mainBusinessIds: candidateIds,
    offsettingBusinessIds: [],
    spansSeveralSecurities: false,
  };
  if (candidateIds.length <= 1) {
    return unchanged;
  }
  const securityBusinessIds = await injector
    .get(SecurityBusinessesProvider)
    .getAllSecurityBusinessIds();
  if (!candidateIds.some(businessId => securityBusinessIds.has(businessId))) {
    return unchanged;
  }
  const transactions =
    loadedTransactions ??
    (await injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId));
  const mainBusinessIds = pruneOffsettingSecurityCandidates(
    candidateIds,
    transactions,
    securityBusinessIds,
  );
  return {
    mainBusinessIds,
    offsettingBusinessIds: candidateIds.filter(businessId => !mainBusinessIds.includes(businessId)),
    spansSeveralSecurities:
      mainBusinessIds.length > 1 &&
      mainBusinessIds.every(businessId => securityBusinessIds.has(businessId)),
  };
}

/**
 * The security businesses of the executions a securities charge books directly. A stock
 * distribution has no cash leg, so its charge holds the execution alone, with no transaction or
 * document naming a party: its counterparty is the security it was paid in. Resolved by the
 * execution's Poalim key, falling back to its ISIN; an execution whose security has no business yet
 * adds nothing.
 *
 * Only charges typed as foreign securities can book executions (distribution charges are created
 * that way, and a merge types its result so), so other charges skip the lookup.
 */
async function linkedExecutionBusinessIds(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<string[]> {
  if (charge.type !== 'FOREIGN_SECURITIES') {
    return [];
  }
  const executions = (
    await injector.get(ForeignSecuritiesProvider).executionsByChargeIdLoader.load(charge.id)
  ).filter(execution => execution.owner_id === charge.owner_id);
  if (executions.length === 0) {
    return [];
  }
  const identifierLoader = injector.get(
    SecurityBusinessesProvider,
  ).getSecurityBusinessByIdentifierLoader;
  const businessIds = await Promise.all(
    executions.map(async execution => {
      const byKey = await identifierLoader.load({
        ownerId: charge.owner_id,
        type: 'POALIM_SECURITY_KEY',
        value: execution.security,
      });
      if (byKey) {
        return byKey.id;
      }
      if (!execution.isin) {
        return null;
      }
      const byIsin = await identifierLoader.load({
        ownerId: charge.owner_id,
        type: 'ISIN',
        value: execution.isin,
      });
      return byIsin?.id ?? null;
    }),
  );
  return [...new Set(businessIds.filter((id): id is string => !!id))];
}

export async function getChargeBusinesses(chargeRef: ChargeRef, injector: Injector) {
  const charge = await resolveCharge(chargeRef, injector);

  if (isEnrichedFilteredCharge(charge)) {
    // business_array folds in transactions, documents, ledger and misc-expense
    // parties (minus the owner), so no child-table loads are needed.
    const sqlMainBusinessIds = (charge.main_business_array as string[] | null) ?? [];
    const linkedBusinessIds = await linkedExecutionBusinessIds(charge, injector);
    const candidateIds = [...new Set([...sqlMainBusinessIds, ...linkedBusinessIds])];
    // the SQL knows nothing of executions booked directly, so its single-candidate answer stands
    // only when they add no candidate
    const addsLinked = candidateIds.length > sqlMainBusinessIds.length;
    const mainBusinesses = await narrowMainBusinessIds(charge.id, candidateIds, injector);
    // A single SQL candidate only becomes the counterparty when it joins a `businesses` row (so a
    // tax category never does) — that is `business_id`. Pruning must not bypass that check, so the
    // pruned survivor is used only where the SQL had several candidates to begin with, or where a
    // directly booked execution's security (always a business) joined them.
    const narrowedToOne =
      (sqlMainBusinessIds.length > 1 || addsLinked) && mainBusinesses.mainBusinessIds.length === 1;
    const narrowedMainBusinessId = narrowedToOne ? mainBusinesses.mainBusinessIds[0] : null;
    return {
      allBusinessIds: [...new Set([...(charge.business_array ?? []), ...linkedBusinessIds])],
      ...mainBusinesses,
      mainBusinessId: addsLinked
        ? narrowedMainBusinessId
        : ((charge.business_id as string | null) ?? narrowedMainBusinessId),
    };
  }

  const [transactions, documents, ledgerRecords, miscExpenses, linkedBusinessIds] =
    await Promise.all([
      injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(charge.id),
      injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(charge.id),
      injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(charge.id),
      injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(charge.id),
      linkedExecutionBusinessIds(charge, injector),
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

  // a stock distribution's security: the charge's party, though no transaction names it
  linkedBusinessIds.map(id => {
    allBusinessIdsSet.add(id);
    mainBusinessIdsSet.add(id);
  });

  const allBusinessIds = Array.from(allBusinessIdsSet);
  const mainBusinesses = await narrowMainBusinessIds(
    charge.id,
    Array.from(mainBusinessIdsSet),
    injector,
    transactions,
  );

  let mainBusinessId: string | null = null;

  if (mainBusinesses.mainBusinessIds.length === 1) {
    mainBusinessId = mainBusinesses.mainBusinessIds[0];
  }

  return {
    allBusinessIds,
    ...mainBusinesses,
    mainBusinessId,
  };
}

export type ChargeDocumentsMeta = {
  receiptAmount: number;
  receiptCount: number;
  invoiceAmount: number;
  invoiceCount: number;
  documentsAmount: number | null;
  documentsVatAmount: number | null;
  documentsCount: number;
  documentsCurrency: Currency | null;
  invalidDocuments: boolean;
  documentsMinDate: TimelessDateString | null;
  documentsMaxDate: TimelessDateString | null;
};

export async function getChargeDocumentsMeta(
  chargeRef: ChargeRef,
  injector: Injector,
): Promise<ChargeDocumentsMeta> {
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
  let documentsMinAccountancyDate: TimelessDateString | null = null;
  let documentsMinAnyDate: TimelessDateString | null = null;
  let documentsMaxAccountancyDate: TimelessDateString | null = null;
  let documentsMaxDate: TimelessDateString | null = null;

  for (const d of documents) {
    const amount = d.total_amount ?? 0;
    let factor = 1;
    if (d.debtor_id === charge.owner_id) {
      factor *= -1;
    }

    documentsMinAnyDate = minTimelessDate(documentsMinAnyDate, d.date);
    documentsMaxDate = maxTimelessDate(documentsMaxDate, d.date);

    if (isInvoice(d.type)) {
      invoiceCount++;
      invoiceAmount += amount * factor;
      if (d.vat_amount != null) {
        invoiceVatAmount ??= 0;
        invoiceVatAmount += (d.vat_amount ?? 0) * factor;
      }
      documentsMinAccountancyDate = minTimelessDate(documentsMinAccountancyDate, d.date);
      documentsMaxAccountancyDate = maxTimelessDate(documentsMaxAccountancyDate, d.date);
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
      documentsMinAccountancyDate = minTimelessDate(documentsMinAccountancyDate, d.date);
      documentsMaxAccountancyDate = maxTimelessDate(documentsMaxAccountancyDate, d.date);
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
  }

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
    documentsMinDate: documentsMinAccountancyDate ?? documentsMinAnyDate,
    documentsMaxDate: documentsMaxAccountancyDate ?? documentsMaxDate,
  };
}

export async function getChargeTransactionsMeta(
  chargeRef: ChargeRef,
  injector: Injector,
): Promise<TransactionsMeta> {
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
      transactionsMinDebitDate: optionalDateToTimelessDateString(
        chargeRef.transactions_min_debit_timestamp,
      ),
      transactionsMinEventDate: chargeRef.transactions_min_event_date,
      transactionsMaxDebitDate: optionalDateToTimelessDateString(
        chargeRef.transactions_max_debit_timestamp,
      ),
      transactionsMaxEventDate: chargeRef.transactions_max_event_date,
    };
  }

  const chargeId = typeof chargeRef === 'string' ? chargeRef : chargeRef.id;
  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(chargeId);

  return getTransactionsMeta(transactions);
}

export type ChargeLedgerMeta = {
  ledgerMinValueDate: TimelessDateString | null;
  ledgerMinInvoiceDate: TimelessDateString | null;
  ledgerMaxValueDate: TimelessDateString | null;
  ledgerMaxInvoiceDate: TimelessDateString | null;
};

export async function getChargeLedgerMeta(
  chargeRef: ChargeRef,
  injector: Injector,
): Promise<ChargeLedgerMeta> {
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
