export enum MissingChargeInfo {
  Counterparty = 'COUNTERPARTY',
  TransactionDescription = 'TRANSACTION_DESCRIPTION',
  Tags = 'TAGS',
  Vat = 'VAT',
  Documents = 'DOCUMENTS',
}

export enum ChargeSortByField {
  Date = 'DATE',
  Amount = 'AMOUNT',
  AbsAmount = 'ABS_AMOUNT',
}

export enum TransactionDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

export enum Currency {
  Usd = 'USD',
  Ils = 'ILS',
  Gbp = 'GBP',
  Eur = 'EUR',
  // TODO: use symbol
  Grt = 'GRT',
  // TODO: use symbol
  Usdc = 'USDC',
}

export enum DocumentType {
  Invoice = 'INVOICE',
  Receipt = 'RECEIPT',
  InvoiceReceipt = 'INVOICE_RECEIPT',
  Proforma = 'PROFORMA',
  Unprocessed = 'UNPROCESSED',
}
