import {
  DocumentType,
  GreenInvoiceCountry,
  GreenInvoiceCurrency,
  GreenInvoiceDiscountType,
  GreenInvoiceDocumentLang,
  GreenInvoiceLinkType,
  GreenInvoicePaymentAppType,
  GreenInvoicePaymentCardType,
  GreenInvoicePaymentDealType,
  GreenInvoicePaymentSubType,
  GreenInvoicePaymentType,
  GreenInvoiceVatType,
} from '../../../../../gql/graphql.js';

type Discount = {
  amount: number;
  type: GreenInvoiceDiscountType;
};

type Client = {
  country?: GreenInvoiceCountry;
  emails?: Array<string>;
  id: string;
  name?: string;
  phone?: string;
  taxId?: string;
  self?: boolean;
  address?: string;
  city?: string;
  zip?: string;
  fax?: string;
  mobile?: string;
  add?: boolean;
};

type Income = {
  amount?: number;
  amountTotal?: number;
  catalogNum?: string;
  currency: GreenInvoiceCurrency;
  currencyRate?: number;
  description: string;
  itemId?: string;
  price: number;
  quantity: number;
  vat?: number;
  vatRate?: number;
  vatType: GreenInvoiceVatType;
};

type Payment = {
  currency: GreenInvoiceCurrency;
  currencyRate?: number;
  date?: string;
  price: number;
  type: GreenInvoicePaymentType;
  subType?: GreenInvoicePaymentSubType;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  chequeNum?: string;
  accountId?: string;
  transactionId?: string;
  appType?: GreenInvoicePaymentAppType;
  cardType?: GreenInvoicePaymentCardType;
  cardNum?: string;
  dealType?: GreenInvoicePaymentDealType;
  numPayments?: number;
  firstPayment?: number;
};

export type PreviewDocumentInput = {
  description?: string;
  remarks?: string;
  footer?: string;
  type: DocumentType;
  date?: string;
  dueDate?: string;
  lang: GreenInvoiceDocumentLang;
  currency: GreenInvoiceCurrency;
  vatType: GreenInvoiceVatType;
  discount?: Discount;
  rounding?: boolean;
  signed?: boolean;
  maxPayments?: number;
  client?: Client;
  income?: Array<Income>;
  payment?: Array<Payment>;
  linkedDocumentIds?: Array<string>;
  linkedPaymentId?: string;
  linkType?: GreenInvoiceLinkType;
};

export type { Discount, Client, Income, Payment };
