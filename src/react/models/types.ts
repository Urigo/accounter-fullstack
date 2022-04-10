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
