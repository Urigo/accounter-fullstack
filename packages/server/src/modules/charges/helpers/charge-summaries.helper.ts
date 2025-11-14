import { Injector } from 'graphql-modules';
import { isInvoice, isReceipt } from '@modules/documents/helpers/common.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency, DocumentType } from '@shared/enums';
import { ChargesTempProvider } from '../providers/charges-temp.provider.js';

export async function getChargeBusinesses(chargeId: string, injector: Injector) {
  const [charge, transactions, documents, ledgerRecords, miscExpenses] = await Promise.all([
    injector.get(ChargesTempProvider).getChargeByIdLoader.load(chargeId),
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
    if (d.creditor_id && d.creditor_id !== charge.owner_id) {
      allBusinessIdsSet.add(d.creditor_id);
      mainBusinessIdsSet.add(d.creditor_id);
    }
    if (d.debtor_id && d.debtor_id !== charge.owner_id) {
      allBusinessIdsSet.add(d.debtor_id);
      mainBusinessIdsSet.add(d.debtor_id);
    }
  });

  ledgerRecords.map(lr => {
    if (lr.credit_entity1 && lr.credit_entity1 !== charge.owner_id) {
      allBusinessIdsSet.add(lr.credit_entity1);
    }
    if (lr.credit_entity2 && lr.credit_entity2 !== charge.owner_id) {
      allBusinessIdsSet.add(lr.credit_entity2);
    }
    if (lr.debit_entity1 && lr.debit_entity1 !== charge.owner_id) {
      allBusinessIdsSet.add(lr.debit_entity1);
    }
    if (lr.debit_entity2 && lr.debit_entity2 !== charge.owner_id) {
      allBusinessIdsSet.add(lr.debit_entity2);
    }
  });

  miscExpenses.map(me => {
    if (me.creditor_id && me.creditor_id !== charge.owner_id) {
      allBusinessIdsSet.add(me.creditor_id);
    }
    if (me.debtor_id && me.debtor_id !== charge.owner_id) {
      allBusinessIdsSet.add(me.debtor_id);
    }
  });

  const allBusinessIds = Array.from(allBusinessIdsSet);
  const mainBusinessIds = Array.from(mainBusinessIdsSet);

  let mainBusiness: string | null = null;

  if (mainBusinessIds.length === 1) {
    mainBusiness = mainBusinessIds[0];
  }

  return {
    allBusinessIds,
    mainBusiness,
  };
}

export async function getChargeDocumentsAmounts(chargeId: string, injector: Injector) {
  const [charge, documents] = await Promise.all([
    injector.get(ChargesTempProvider).getChargeByIdLoader.load(chargeId),
    injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
  ]);

  let receiptAmount = 0;
  let invoiceAmount = 0;
  let invoiceVatAmount: number | null = null;
  const currenciesSet = new Set<Currency>();

  documents.map(d => {
    const amount = d.total_amount ?? 0;
    let factor = 1;
    if (d.debtor_id === charge.owner_id) {
      factor = factor * -1;
    }
    if (d.type === DocumentType.CreditInvoice) {
      factor = factor * -1;
    }

    if (isInvoice(d.type)) {
      invoiceAmount += amount * factor;
      if (d.vat_amount != null) {
        invoiceVatAmount ??= 0;
        invoiceVatAmount += (d.vat_amount ?? 0) * factor;
      }
    }
    if (isReceipt(d.type)) {
      receiptAmount += amount * factor;
    }
    currenciesSet.add(d.currency_code as Currency);
  });

  return {
    receiptAmount,
    invoiceAmount,
    invoiceVatAmount,
    currencies: Array.from(currenciesSet),
  };
}

export async function getChargeTransactionsAmounts(chargeId: string, injector: Injector) {
  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(chargeId);

  let transactionsAmount: number | null = null;
  const currenciesSet = new Set<Currency>();

  transactions.map(t => {
    const amount = Number.isNaN(t.amount) ? null : Number(t.amount);
    if (amount != null) {
      transactionsAmount ??= 0;
      transactionsAmount += amount;
      currenciesSet.add(t.currency as Currency);
    }
  });

  return {
    transactionsAmount,
    currencies: Array.from(currenciesSet),
  };
}
