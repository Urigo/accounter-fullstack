import type {
  DocumentLang,
  ExpenseDocumentType,
  Currency as GreenInvoiceCurrency,
  DocumentType as GreenInvoiceDocumentType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_0_subType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_appType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_cardType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_dealType,
  queryInput_previewDocument_input_discount_type,
  queryInput_previewDocument_input_linkType,
  VatType,
} from '@accounter/green-invoice-graphql';
import {
  Currency,
  DocumentType,
  GreenInvoiceDiscountType,
  GreenInvoiceDocumentLang,
  GreenInvoiceLinkType,
  GreenInvoicePaymentAppType,
  GreenInvoicePaymentCardType,
  GreenInvoicePaymentDealType,
  GreenInvoicePaymentSubType,
  GreenInvoiceVatType,
} from '@shared/gql-types';

export function normalizeDocumentType(
  rawType?: GreenInvoiceDocumentType | ExpenseDocumentType | number | null,
): DocumentType {
  if (!rawType) {
    return DocumentType.Unprocessed;
  }

  if (typeof rawType === 'string' && rawType.startsWith('_')) {
    const int = parseInt(rawType.replace('_', ''));
    if (Number.isInteger(int)) {
      rawType = int;
    }
  }

  switch (rawType) {
    case 20:
      // חשבון / אישור תשלום
      return DocumentType.Invoice;
    case 300:
      // חשבונית עסקה
      return DocumentType.Proforma;
    case 305:
      // חשבונית מס
      return DocumentType.Invoice;
    case 320:
      // חשבונית מס\קבלה
      return DocumentType.InvoiceReceipt;
    case 330:
      // חשבונית זיכוי
      return DocumentType.CreditInvoice;
    case 400:
      // קבלה
      return DocumentType.Receipt;
    case 405:
      // קבלה על תרומה
      return DocumentType.Unprocessed;
    default:
      console.log(`Got a new document type from Green Invoice: ${rawType}`);
      return DocumentType.Unprocessed;
  }
}

export function getGreenInvoiceDocumentType(documentType: DocumentType): GreenInvoiceDocumentType {
  switch (documentType) {
    case DocumentType.Invoice:
      return '_305';
    case DocumentType.Proforma:
      return '_300';
    case DocumentType.InvoiceReceipt:
      return '_320';
    case DocumentType.CreditInvoice:
      return '_330';
    case DocumentType.Receipt:
      return '_400';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentLanguage(lang: GreenInvoiceDocumentLang): DocumentLang {
  switch (lang) {
    case 'HEBREW':
      return 'he';
    case 'ENGLISH':
      return 'en';
    default:
      throw new Error(`Unsupported document language: ${lang}`);
  }
}

export function getGreenInvoiceDocumentVatType(vatType: GreenInvoiceVatType): VatType {
  switch (vatType) {
    case 'DEFAULT':
      return '_0';
    case 'EXEMPT':
      return '_1';
    case 'MIXED':
      return '_2';
    default:
      throw new Error(`Unsupported VAT type: ${vatType}`);
  }
}

export function getGreenInvoiceDocumentDiscountType(
  discountType: GreenInvoiceDiscountType,
): queryInput_previewDocument_input_discount_type {
  switch (discountType) {
    case 'PERCENTAGE':
      return 'percentage';
    case 'SUM':
      return 'sum';
    default:
      throw new Error(`Unsupported discount type: ${discountType}`);
  }
}

export function getGreenInvoiceDocumentPaymentSubType(
  subType: GreenInvoicePaymentSubType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_0_subType {
  switch (subType) {
    case 'BITCOIN':
      return '_1';
    case 'BUYME_VOUCHER':
      return '_7';
    case 'ETHEREUM':
      return '_6';
    case 'GIFT_CARD':
      return '_4';
    case 'MONEY_EQUAL':
      return '_2';
    case 'NII_EMPLOYEE_DEDUCTION':
      return '_5';
    case 'PAYONEER':
      return '_8';
    case 'V_CHECK':
      return '_3';
    default:
      throw new Error(`Unsupported payment sub-type: ${subType}`);
  }
}

export function getGreenInvoiceDocumentPaymentAppType(
  appType: GreenInvoicePaymentAppType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_appType {
  switch (appType) {
    case 'APPLE_PAY':
      return '_6';
    case 'BIT':
      return '_1';
    case 'CULO':
      return '_4';
    case 'GOOGLE_PAY':
      return '_5';
    case 'PAYBOX':
      return '_3';
    case 'PAY_BY_PEPPER':
      return '_2';
    default:
      throw new Error(`Unsupported payment app type: ${appType}`);
  }
}

export function getGreenInvoiceDocumentPaymentCardType(
  cardType: GreenInvoicePaymentCardType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_cardType {
  switch (cardType) {
    case 'AMERICAN_EXPRESS':
      return '_4';
    case 'DINERS':
      return '_5';
    case 'ISRACARD':
      return '_1';
    case 'MASTERCARD':
      return '_3';
    // case 'UNKNOWN':
    //   return '_0'; // TODO: why is this not supported?
    case 'VISA':
      return '_2';
    default:
      throw new Error(`Unsupported payment card type: ${cardType}`);
  }
}

export function getGreenInvoiceDocumentPaymentDealType(
  dealType: GreenInvoicePaymentDealType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_dealType {
  switch (dealType) {
    case 'CREDIT':
      return '_3';
    case 'DEFERRED':
      return '_4';
    case 'OTHER':
      return '_5';
    case 'PAYMENTS':
      return '_2';
    case 'RECURRING':
      return '_6';
    case 'STANDARD':
      return '_1';
    default:
      throw new Error(`Unsupported payment deal type: ${dealType}`);
  }
}

export function getGreenInvoiceDocumentLinkType(
  linkType: GreenInvoiceLinkType,
): queryInput_previewDocument_input_linkType {
  switch (linkType) {
    case 'CANCEL':
      return 'cancel';
    case 'LINK':
      return 'link';
    default:
      throw new Error(`Unsupported link type: ${linkType}`);
  }
}

export function convertCurrencyToGreenInvoice(currency: Currency): GreenInvoiceCurrency {
  switch (currency) {
    case Currency.Aud:
      return 'AUD';
    case Currency.Cad:
      return 'CAD';
    case Currency.Eur:
      return 'EUR';
    case Currency.Gbp:
      return 'GBP';
    case Currency.Ils:
      return 'ILS';
    case Currency.Jpy:
      return 'JPY';
    case Currency.Sek:
      return 'SEK';
    case Currency.Usd:
      return 'USD';
    case Currency.Eth:
    case Currency.Grt:
    case Currency.Usdc:
      throw new Error(`Crypto currency (${currency}) is not supported`);
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}
