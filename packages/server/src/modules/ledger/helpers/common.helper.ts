import type { IGetLedgerRecordsByIdsResult } from '../types.js';

export function getLedgerMeta(records: IGetLedgerRecordsByIdsResult[]) {
  let ledgerMinValueDate: Date | null = null;
  let ledgerMinInvoiceDate: Date | null = null;
  let ledgerMaxValueDate: Date | null = null;
  let ledgerMaxInvoiceDate: Date | null = null;

  records.map(ledger => {
    ledgerMinValueDate ??= ledger.value_date;
    if (ledgerMinValueDate > ledger.value_date) {
      ledgerMinValueDate = ledger.value_date;
    }

    ledgerMinInvoiceDate ??= ledger.invoice_date;
    if (ledgerMinInvoiceDate > ledger.invoice_date) {
      ledgerMinInvoiceDate = ledger.invoice_date;
    }

    ledgerMaxValueDate ??= ledger.value_date;
    if (ledgerMaxValueDate < ledger.value_date) {
      ledgerMaxValueDate = ledger.value_date;
    }

    ledgerMaxInvoiceDate ??= ledger.invoice_date;
    if (ledgerMaxInvoiceDate < ledger.invoice_date) {
      ledgerMaxInvoiceDate = ledger.invoice_date;
    }
  });

  return {
    ledgerMinValueDate,
    ledgerMinInvoiceDate,
    ledgerMaxValueDate,
    ledgerMaxInvoiceDate,
  };
}
