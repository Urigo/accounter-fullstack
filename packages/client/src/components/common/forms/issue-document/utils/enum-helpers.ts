import { CountryCode } from '@/helpers/countries.js';
import {
  Currency,
  DocumentDiscountType,
  DocumentLanguage,
  DocumentPaymentRecordCardType,
  DocumentType,
  DocumentVatType,
  PaymentType,
} from '../../../../../gql/graphql.js';
import { currencyCodeToLabel, getDocumentNameFromType } from '../../../../../helpers/index.js';

// Helper functions to get enum options with labels
export const getDocumentLangOptions = () => [
  { value: DocumentLanguage.English, label: 'English' },
  { value: DocumentLanguage.Hebrew, label: 'Hebrew' },
];

// Currencies that can be issued on a document (crypto is not supported by the issuing provider)
const DOCUMENT_CURRENCIES = [
  Currency.Ils,
  Currency.Usd,
  Currency.Eur,
  Currency.Gbp,
  Currency.Jpy,
  Currency.Aud,
  Currency.Cad,
  Currency.Sek,
];

export const getCurrencyOptions = () =>
  DOCUMENT_CURRENCIES.map(currency => ({ value: currency, label: currencyCodeToLabel(currency) }));

export const getVatTypeOptions = () => [
  { value: DocumentVatType.Default, label: 'Default (Based on business type)' },
  { value: DocumentVatType.Exempt, label: 'Exempt (VAT free)' },
  { value: DocumentVatType.Mixed, label: 'Mixed (Contains exempt and due VAT income rows)' },
];

export const getDiscountTypeOptions = () => [
  { value: DocumentDiscountType.Percentage, label: 'Percentage' },
  { value: DocumentDiscountType.Sum, label: 'Fixed Amount' },
];

export const getDocumentTypeOptions = () =>
  [
    DocumentType.CreditInvoice,
    DocumentType.Invoice,
    DocumentType.InvoiceReceipt,
    DocumentType.Receipt,
    DocumentType.Proforma,
  ].map(type => ({
    value: type,
    label: getDocumentNameFromType(type),
  }));
// [
//   { value: DocumentType.Other, label: 'OTHER' },
//   { value: DocumentType.Unprocessed, labl: 'UNPROCESSED' },
//   { value: DocumentType.PriceQuote, label: 'Price Quote' },
//   { value: DocumentType.Order, label: 'Order' },
//   { value: DocumentType.DeliveryNote, label: 'Delivery Note' },
//   { value: DocumentType.ReturnNote, label: 'Return Note' },
//   { value: DocumentType.TransactionInvoice, label: 'Transaction Invoice' },
//   { value: DocumentType.DonationReceipt, label: 'Donation Receipt' },
//   { value: DocumentType.PurchaseOrder, label: 'Purchase Order' },
//   { value: DocumentType.DepositReceipt, label: 'Deposit Receipt' },
//   { value: DocumentType.DepositWithdrawal, label: 'Deposit Withdrawal' },
// ];

export const getCountryOptions = () =>
  Object.entries(CountryCode).map(([name, code]) => ({
    value: code,
    label: name,
  }));

export const getPaymentTypeOptions = () => [
  { value: PaymentType.TaxDeduction, label: 'Tax deduction (ניכוי במקור)' },
  { value: PaymentType.Cash, label: 'Cash (מזומן)' },
  { value: PaymentType.Cheque, label: 'Cheque (צ׳ק)' },
  { value: PaymentType.CreditCard, label: 'Credit card (כרטיס אשראי)' },
  { value: PaymentType.WireTransfer, label: 'Wire-transfer (העברה בנקאית)' },
  { value: PaymentType.Paypal, label: 'PayPal (פייפאל)' },
  { value: PaymentType.OtherDeduction, label: 'Other deduction (ניכוי אחר)' },
  { value: PaymentType.PaymentApp, label: 'Payment app (אפליקציית תשלום)' },
  { value: PaymentType.Other, label: 'Other (אחר)' },
];

export const getCardTypeOptions = () => [
  { value: DocumentPaymentRecordCardType.Unknown, label: 'Unknown (לא ידוע)' },
  { value: DocumentPaymentRecordCardType.Isracard, label: 'Isracard (ישראכרט)' },
  { value: DocumentPaymentRecordCardType.Visa, label: 'Visa (ויזה)' },
  { value: DocumentPaymentRecordCardType.Mastercard, label: 'Mastercard (מאסטרקארד)' },
  {
    value: DocumentPaymentRecordCardType.AmericanExpress,
    label: 'American Express (אמריקן אקספרס)',
  },
  { value: DocumentPaymentRecordCardType.Diners, label: 'Diners (דיינרס)' },
];
