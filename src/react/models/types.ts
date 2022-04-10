export interface TransactionType {
  tax_invoice_date: Date | null;
  tax_category: string | null;
  currency_code: string;
  event_date: Date;
  debit_date: Date | null;
  event_amount: string;
  financial_entity: string | null;
  vat: number | null;
  user_description: string | null;
  tax_invoice_number: string | null;
  tax_invoice_amount: number | null;
  receipt_number: number | null;
  business_trip: string | null;
  personal_category: string | null;
  financial_accounts_to_balance: string | null;
  bank_reference: string | null;
  event_number: string | null;
  account_number: number;
  account_type: string;
  is_conversion: boolean;
  currency_rate: number;
  contra_currency_code: number | null;
  bank_description: string;
  withholding_tax: number | null;
  interest: number | null;
  proforma_invoice_file: string | null;
  original_id: string;
  id: string;
  reviewed: boolean | null;
  hashavshevet_id: number | null;
  current_balance: number;
  tax_invoice_file: string | null;
  detailed_bank_description: string;
  links: any | null;
  receipt_image: string | null;
  receipt_url: string | null;
  receipt_date: string | null;
}

export type TransactionColumn =
  | 'Date'
  | 'Amount'
  | 'Entity'
  | 'Description'
  | 'Category'
  | 'VAT'
  | 'Account'
  | 'Share with'
  | 'Tax category'
  | 'Bank Description'
  | 'Invoice Img'
  | 'Invoice Date'
  | 'Invoice Number'
  | 'Invoice File'
  | 'Receipt File'
  | 'Receipt Image'
  | 'Receipt Date'
  | 'Receipt Number'
  | 'Receipt URL'
  | 'Links';

export interface LastInvoiceNumber {
  tax_invoice_number: number;
  event_date: Date;
  financial_entity: string;
  user_description: string;
  event_amount: number;
}

export interface MissingInvoice {
  event_date: Date;
  event_amount: number;
  currency_code: string;
  financial_entity: string;
  user_description: string;
  tax_invoice_number: number;
}

export interface ProfitRowType {
  date: string;
  business_income: number;
  business_expenses: number;
  overall_business_profit: number;
  business_profit_share: number;
  private_expenses: number;
  overall_private: number;
}

export interface ThisMonthPrivateExpensesType {
  personal_category: string;
  overall_sum: number;
}

export interface VatTransaction {
  overall_vat_status: string;
  vat: number;
  event_date: Date;
  event_amount: number;
  financial_entity: string;
  user_description: string;
}

export interface MonthTaxReport {
  תאריך_חשבונית: string;
  חשבון_חובה_1: string;
  סכום_חובה_1: string;
  מטח_סכום_חובה_1: string;
  מטבע: string;
  חשבון_זכות_1: string;
  סכום_זכות_1: string;
  מטח_סכום_זכות_1: string;
  חשבון_חובה_2: string;
  סכום_חובה_2: string;
  מטח_סכום_חובה_2: string;
  חשבון_זכות_2: string;
  סכום_זכות_2: string;
  מטח_סכום_זכות_2: string;
  פרטים: string;
  אסמכתא_1: string;
  אסמכתא_2: string;
  סוג_תנועה: string;
  תאריך_ערך: string;
  תאריך_3: string;
}

export interface TopPrivateNotCategorizedExpense {
  amount: number;
  currency_code: string;
  bank_description: string;
  date: string;
  description: string;
}
