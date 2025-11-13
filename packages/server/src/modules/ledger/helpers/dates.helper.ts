export function getLedgerMinInvoiceDate(
  ledgerRecords: {
    invoice_date: Date;
  }[],
): Date | null {
  if (!ledgerRecords.length) {
    return null;
  }
  return ledgerRecords
    .map(t => t.invoice_date)
    .filter(date => !!date)
    .reduce((min, curr) => (curr < min ? curr : min));
}

export function getLedgerMinDebitDate(
  ledgerRecords: {
    value_date: Date;
  }[],
): Date | null {
  if (!ledgerRecords.length) {
    return null;
  }
  return ledgerRecords
    .map(t => t.value_date)
    .filter(date => !!date)
    .reduce((min, curr) => (curr < min ? curr : min));
}
