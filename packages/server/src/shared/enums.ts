export enum MissingChargeInfo {
  Counterparty = 'COUNTERPARTY',
  Description = 'DESCRIPTION',
  Documents = 'DOCUMENTS',
  Tags = 'TAGS',
  TaxCategory = 'TAX_CATEGORY',
  Transactions = 'TRANSACTIONS',
  Vat = 'VAT',
}

export enum ChargeSortByField {
  AbsAmount = 'ABS_AMOUNT',
  Amount = 'AMOUNT',
  Date = 'DATE',
}

export enum TransactionDirection {
  Credit = 'CREDIT',
  Debit = 'DEBIT',
}

export enum Currency {
  Aud = 'AUD',
  Cad = 'CAD',
  Eth = 'ETH',
  Eur = 'EUR',
  Gbp = 'GBP',
  Grt = 'GRT',
  Ils = 'ILS',
  Jpy = 'JPY',
  Sek = 'SEK',
  Usd = 'USD',
  Usdc = 'USDC',
}

export enum DocumentType {
  CreditInvoice = 'CREDIT_INVOICE',
  Invoice = 'INVOICE',
  InvoiceReceipt = 'INVOICE_RECEIPT',
  Other = 'OTHER',
  Proforma = 'PROFORMA',
  Receipt = 'RECEIPT',
  Unprocessed = 'UNPROCESSED',
}

export enum ChargeTypeEnum {
  BankDeposit = 'BankDepositCharge',
  BusinessTrip = 'BusinessTripCharge',
  Common = 'CommonCharge',
  Conversion = 'ConversionCharge',
  CreditcardBankCharge = 'CreditcardBankCharge',
  Dividend = 'DividendCharge',
  Financial = 'FinancialCharge',
  ForeignSecurities = 'ForeignSecuritiesCharge',
  InternalTransfer = 'InternalTransferCharge',
  MonthlyVat = 'MonthlyVatCharge',
  Salary = 'SalaryCharge',
}
