import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import type { FinancialAmount } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { IGetChargesByIdsResult, IGetTempChargesByIdsResult } from '../types.js';

export function calculateTotalAmount(charge: IGetChargesByIdsResult): FinancialAmount | null {
  if (charge.type === 'PAYROLL' && charge.transactions_event_amount != null) {
    return formatFinancialAmount(charge.transactions_event_amount, DEFAULT_LOCAL_CURRENCY);
  }
  if (charge.documents_event_amount != null && charge.documents_currency) {
    return formatFinancialAmount(charge.documents_event_amount, charge.documents_currency);
  }
  if (charge.transactions_event_amount != null && charge.transactions_currency) {
    return formatFinancialAmount(charge.transactions_event_amount, charge.transactions_currency);
  }
  return null;
}

export async function getChargeBusinessArray(
  DbCharge: IGetTempChargesByIdsResult,
  _: unknown,
  { injector }: GraphQLModules.Context,
) {
  const transactionsPromise = injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(DbCharge.id);
  const documentsPromise = injector
    .get(DocumentsProvider)
    .getDocumentsByChargeIdLoader.load(DbCharge.id);
  const miscExpensesPromise = injector
    .get(MiscExpensesProvider)
    .getExpensesByChargeIdLoader.load(DbCharge.id);
  const ledgerRecordsPromise = injector
    .get(LedgerProvider)
    .getLedgerRecordsByChargesIdLoader.load(DbCharge.id);
  const [transactions, documents, miscExpenses, ledgerRecords] = await Promise.all([
    transactionsPromise,
    documentsPromise,
    miscExpensesPromise,
    ledgerRecordsPromise,
  ]);
  const businesses = new Set<string>();
  transactions.map(transaction => {
    if (transaction.business_id) {
      businesses.add(transaction.business_id);
    }
  });
  documents.map(document => {
    if (document.creditor_id) {
      businesses.add(document.creditor_id);
    }
    if (document.debtor_id) {
      businesses.add(document.debtor_id);
    }
  });
  miscExpenses.map(expense => {
    if (expense.creditor_id) {
      businesses.add(expense.creditor_id);
    }
    if (expense.debtor_id) {
      businesses.add(expense.debtor_id);
    }
  });
  ledgerRecords.map(record => {
    if (record.credit_entity1) {
      businesses.add(record.credit_entity1);
    }
    if (record.credit_entity2) {
      businesses.add(record.credit_entity2);
    }
    if (record.debit_entity1) {
      businesses.add(record.debit_entity1);
    }
    if (record.debit_entity2) {
      businesses.add(record.debit_entity2);
    }
  });

  return Array.from(businesses);
}
