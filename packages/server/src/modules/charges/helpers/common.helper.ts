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

export async function calculateTotalAmount(
  chargeId: string,
  injector: Injector,
  defaultLocalCurrency: Currency,
): Promise<FinancialAmount | null> {
  try {
    const [
      charge,
      { transactionsAmount, transactionsCurrency },
      { documentsCurrency, documentsAmount },
    ] = await Promise.all([
      injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
      getChargeTransactionsMeta(chargeId, injector),
      getChargeDocumentsMeta(chargeId, injector),
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
    throw new Error('Failed to calculate total amount for charge');
  }
}

export async function getChargeBusinesses(chargeId: string, injector: Injector) {
  const [charge, transactions, documents, ledgerRecords, miscExpenses] = await Promise.all([
    injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
    injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId),
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
    injector.get(LedgerProvider).getLedgerRecordsByChargesIdLoader.load(chargeId),
    injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(chargeId),
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

export async function getChargeDocumentsMeta(chargeId: string, injector: Injector) {
  const [charge, documents] = await Promise.all([
    injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
  ]);

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

  documents.map(d => {
    const amount = d.total_amount ?? 0;
    let factor = 1;
    if (d.debtor_id === charge.owner_id) {
      factor *= -1;
    }
    if (d.type === DocumentType.CreditInvoice) {
      factor *= -1;
    }

    if (d.date) {
      documentsMinAnyDate ??= d.date;
      if (documentsMinAnyDate > d.date) {
        documentsMinAnyDate = d.date;
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
    documentsVatAmount: invoiceVatAmount == null ? receiptVatAmount : invoiceVatAmount,
    documentsCount: documents.length,
    documentsCurrency: currencies.length === 1 ? currencies[0] : null,
    invalidDocuments,
    documentsMinDate: documentsMinAccountancyDate ?? (documentsMinAnyDate as Date | null),
  };
}

export async function getChargeTransactionsMeta(chargeId: string, injector: Injector) {
  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(chargeId);

  return getTransactionsMeta(transactions);
}

export async function getChargeLedgerMeta(chargeId: string, injector: Injector) {
  const ledgerRecords = await injector
    .get(LedgerProvider)
    .getLedgerRecordsByChargesIdLoader.load(chargeId);

  return getLedgerMeta(ledgerRecords);
}

export async function getChargeTaxCategoryId(
  chargeId: string,
  injector: Injector,
): Promise<string | null> {
  const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
  if (charge.tax_category_id) {
    return charge.tax_category_id;
  }

  const { mainBusinessId } = await getChargeBusinesses(chargeId, injector);

  if (!mainBusinessId) {
    return null;
  }

  const taxCategory = await injector
    .get(TaxCategoriesProvider)
    .taxCategoryByBusinessAndOwnerIDsLoader.load({
      businessId: mainBusinessId,
      ownerId: charge.owner_id,
    });

  return taxCategory?.id ?? null;
}
