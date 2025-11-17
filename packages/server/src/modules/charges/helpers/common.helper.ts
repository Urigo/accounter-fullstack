import { Injector } from 'graphql-modules';
import { isInvoice, isReceipt } from '@modules/documents/helpers/common.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { getTransactionsMeta } from '@modules/transactions/helpers/common.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { Currency, DocumentType } from '@shared/enums';
import type { FinancialAmount } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { ChargesSimpleProvider } from '../providers/charges-simple.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';

export async function calculateTotalAmount(
  chargeId: string,
  injector: Injector,
  defaultLocalCurrency: Currency,
): Promise<FinancialAmount | null> {
  const [charge, { transactionsAmount, transactionsCurrency }] = await Promise.all([
    injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
    getChargeTransactionsMeta(chargeId, injector),
  ]);

  if (charge.type === 'PAYROLL' && transactionsAmount != null) {
    return formatFinancialAmount(transactionsAmount, defaultLocalCurrency);
  }
  if (charge.documents_event_amount != null && charge.documents_currency) {
    return formatFinancialAmount(charge.documents_event_amount, charge.documents_currency);
  }
  if (transactionsAmount != null && transactionsCurrency) {
    return formatFinancialAmount(transactionsAmount, transactionsCurrency);
  }
  return null;
}

export async function getChargeBusinesses(chargeId: string, injector: Injector) {
  const [charge, transactions, documents, ledgerRecords, miscExpenses] = await Promise.all([
    injector.get(ChargesSimpleProvider).getChargeByIdLoader.load(chargeId),
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

  let mainBusiness: string | null = null;

  if (mainBusinessIds.length === 1) {
    mainBusiness = mainBusinessIds[0];
  }

  return {
    allBusinessIds,
    mainBusiness,
  };
}

export async function getChargeDocumentsMeta(chargeId: string, injector: Injector) {
  const [charge, documents] = await Promise.all([
    injector.get(ChargesSimpleProvider).getChargeByIdLoader.load(chargeId),
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
      factor *= -1;
    }
    if (d.type === DocumentType.CreditInvoice) {
      factor *= -1;
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

export async function getChargeTransactionsMeta(chargeId: string, injector: Injector) {
  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(chargeId);

  return getTransactionsMeta(transactions);
}
