export enum MissingChargeInfo {
  Counterparty = 'COUNTERPARTY',
  Transactions = 'TRANSACTIONS',
  Tags = 'TAGS',
  Vat = 'VAT',
  Documents = 'DOCUMENTS',
  Description = 'DESCRIPTION',
  TaxCategory = 'TAX_CATEGORY',
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
  Grt = 'GRT',
  Usdc = 'USDC',
}

export enum DocumentType {
  Invoice = 'INVOICE',
  Receipt = 'RECEIPT',
  InvoiceReceipt = 'INVOICE_RECEIPT',
  Proforma = 'PROFORMA',
  Unprocessed = 'UNPROCESSED',
}
