import type { CountryCode } from '@/helpers/countries.js';
import type {
  Currency,
  DocumentDiscountType,
  DocumentLanguage,
  DocumentLinkType,
  DocumentPaymentRecordCardType,
  DocumentType,
  DocumentVatType,
  PaymentType,
} from '../../../../../gql/graphql.js';

type Discount = {
  amount: number;
  type: DocumentDiscountType;
};

type DocumentClient = {
  add?: boolean;
  address?: string;
  city?: string;
  country?: CountryCode;
  emails?: Array<string>;
  fax?: string;
  id: string;
  mobile?: string;
  name?: string;
  phone?: string;
  self?: boolean;
  taxId?: string;
  zip?: string;
};

type Income = {
  amount?: number;
  amountTotal?: number;
  catalogNum?: string;
  currency: Currency;
  currencyRate?: number;
  description: string;
  itemId?: string;
  price: number;
  quantity: number;
  vat?: number;
  vatRate?: number;
  vatType: DocumentVatType;
};

type Payment = {
  currency: Currency;
  currencyRate?: number;
  date?: string;
  price: number;
  type: PaymentType;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  chequeNum?: string;
  accountId?: string;
  transactionId?: string;
  cardType?: DocumentPaymentRecordCardType;
  cardNum?: string;
  numPayments?: number;
  firstPayment?: number;
};

export type PreviewDocumentInput = {
  client?: DocumentClient;
  currency: Currency;
  date?: string;
  description?: string;
  discount?: Discount;
  dueDate?: string;
  footer?: string;
  income?: Array<Income>;
  language: DocumentLanguage;
  linkType?: DocumentLinkType;
  linkedDocumentIds?: Array<string>;
  linkedPaymentId?: string;
  maxPayments?: number;
  payment?: Array<Payment>;
  remarks?: string;
  rounding?: boolean;
  signed?: boolean;
  type: DocumentType;
  vatType: DocumentVatType;
};

export type { Discount, DocumentClient, Income, Payment };
