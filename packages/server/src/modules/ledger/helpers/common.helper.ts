import type { TimelessDateString } from '../../../shared/types/index.js';
import type { IGetLedgerRecordsByIdsResult } from '../types.js';

export function getLedgerMeta(records: IGetLedgerRecordsByIdsResult[]) {
  let ledgerMinValueDate: TimelessDateString | null = null;
  let ledgerMinInvoiceDate: TimelessDateString | null = null;
  let ledgerMaxValueDate: TimelessDateString | null = null;
  let ledgerMaxInvoiceDate: TimelessDateString | null = null;

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
