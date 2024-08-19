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
  Eth = 'ETH',
  Eur = 'EUR',
  Gbp = 'GBP',
  Grt = 'GRT',
  Ils = 'ILS',
  Usd = 'USD',
  Usdc = 'USDC',
}

export enum DocumentType {
  Invoice = 'INVOICE',
  Receipt = 'RECEIPT',
  InvoiceReceipt = 'INVOICE_RECEIPT',
  CreditInvoice = 'CREDIT_INVOICE',
  Proforma = 'PROFORMA',
  Unprocessed = 'UNPROCESSED',
  Other = 'OTHER',
}

export enum ChargeTypeEnum {
  Conversion = 'ConversionCharge',
  Salary = 'SalaryCharge',
  BusinessTrip = 'BusinessTripCharge',
  InternalTransfer = 'InternalTransferCharge',
  Dividend = 'DividendCharge',
  MonthlyVat = 'MonthlyVatCharge',
  Common = 'CommonCharge',
  BankDeposit = 'BankDepositCharge',
  CreditcardBankCharge = 'CreditcardBankCharge',
  Financial = 'FinancialCharge',
}

export enum AccountantStatus {
  Unapproved = 'UNAPPROVED',
  Approved = 'APPROVED',
  Pending = 'PENDING',
}
