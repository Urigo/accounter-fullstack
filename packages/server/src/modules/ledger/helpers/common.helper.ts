import type { IGetLedgerRecordsByIdsResult } from '../types.js';

export function getLedgerMeta(records: IGetLedgerRecordsByIdsResult[]) {
  let ledgerMinValueDate: Date | null = null;
  let ledgerMinInvoiceDate: Date | null = null;

  records.map(ledger => {
    ledgerMinValueDate ??= ledger.value_date;
    if (ledgerMinValueDate > ledger.value_date) {
      ledgerMinValueDate = ledger.value_date;
    }

    ledgerMinInvoiceDate ??= ledger.invoice_date;
    if (ledgerMinInvoiceDate > ledger.invoice_date) {
      ledgerMinInvoiceDate = ledger.invoice_date;
    }
  });

  return {
    ledgerMinValueDate,
    ledgerMinInvoiceDate,
  };
}
