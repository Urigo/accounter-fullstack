import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type {
  _DOLLAR_defs_addDocumentRequest_Input,
  _DOLLAR_defs_Document,
  _DOLLAR_defs_DocumentInputNew_Input,
  _DOLLAR_defs_DocumentLang,
  _DOLLAR_defs_DocumentLinkedDocument,
  _DOLLAR_defs_ExpenseDocumentType,
  _DOLLAR_defs_VatType,
  _DOLLAR_defs_Currency as GreenInvoiceCurrency,
  _DOLLAR_defs_DocumentType as GreenInvoiceDocumentType,
  query_getDocument_payment_items_appType,
  query_getDocument_payment_items_cardType,
  query_getDocument_payment_items_dealType,
  query_getDocument_payment_items_subType,
  query_getDocument_payment_items_type,
  queryInput_previewDocument_input_discount_type,
  queryInput_previewDocument_input_linkType,
} from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { CountryCode } from '@modules/countries/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import type { document_status, IInsertDocumentsParams } from '@modules/documents/types';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import {
  Currency,
  DocumentType,
  GreenInvoiceCountry,
  GreenInvoicePaymentType,
  NewDocumentInfo,
  NewDocumentInput,
  type GreenInvoiceDiscountType,
  type GreenInvoiceDocumentLang,
  type GreenInvoiceLinkType,
  type GreenInvoicePaymentAppType,
  type GreenInvoicePaymentCardType,
  type GreenInvoicePaymentDealType,
  type GreenInvoicePaymentSubType,
  type GreenInvoiceVatType,
} from '@shared/gql-types';
import { formatCurrency, hashStringToInt } from '@shared/helpers';

export function normalizeDocumentType(
  rawType?: GreenInvoiceDocumentType | _DOLLAR_defs_ExpenseDocumentType | number | null,
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

export function getTypeFromGreenInvoiceDocument(
  documentType: GreenInvoiceDocumentType,
): DocumentType {
  switch (documentType) {
    case '_305':
      return DocumentType.Invoice;
    case '_300':
      return DocumentType.Proforma;
    case '_320':
      return DocumentType.InvoiceReceipt;
    case '_330':
      return DocumentType.CreditInvoice;
    case '_400':
      return DocumentType.Receipt;
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentNameFromType(
  documentType: DocumentType | GreenInvoiceDocumentType,
): string {
  switch (documentType) {
    case DocumentType.Invoice:
    case '_305':
      return 'Tax Invoice';
    case DocumentType.Proforma:
    case '_300':
      return 'Proforma Invoice';
    case DocumentType.InvoiceReceipt:
    case '_320':
      return 'Invoice / Receipt';
    case DocumentType.CreditInvoice:
    case '_330':
      return 'Credit Note';
    case DocumentType.Receipt:
    case '_400':
      return 'Receipt';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentLanguage(
  lang: GreenInvoiceDocumentLang,
): _DOLLAR_defs_DocumentLang {
  switch (lang) {
    case 'HEBREW':
      return 'he';
    case 'ENGLISH':
      return 'en';
    default:
      throw new Error(`Unsupported document language: ${lang}`);
  }
}

export function getLanguageFromGreenInvoiceDocument(
  lang: _DOLLAR_defs_DocumentLang,
): GreenInvoiceDocumentLang {
  switch (lang) {
    case 'he':
      return 'HEBREW';
    case 'en':
      return 'ENGLISH';
    default:
      throw new Error(`Unsupported document language: ${lang}`);
  }
}

export function getGreenInvoiceDocumentVatType(vatType: GreenInvoiceVatType): _DOLLAR_defs_VatType {
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

export function getVatTypeFromGreenInvoiceDocument(
  vatType: _DOLLAR_defs_VatType,
): GreenInvoiceVatType {
  switch (vatType) {
    case '_0':
      return 'DEFAULT';
    case '_1':
      return 'EXEMPT';
    case '_2':
      return 'MIXED';
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

export function getGreenInvoiceDocumentPaymentType(
  type: GreenInvoicePaymentType,
): query_getDocument_payment_items_type {
  switch (type) {
    case 'TAX_DEDUCTION':
      return 'NEGATIVE_1';
    case 'CASH':
      return '_1';
    case 'CHEQUE':
      return '_2';
    case 'CREDIT_CARD':
      return '_3';
    case 'WIRE_TRANSFER':
      return '_4';
    case 'PAYPAL':
      return '_5';
    case 'OTHER_DEDUCTION':
      return '_9';
    case 'PAYMENT_APP':
      return '_10';
    case 'OTHER':
      return '_11';
    default:
      throw new Error(`Unsupported payment type: ${type}`);
  }
}

export function getTypeFromGreenInvoiceDocumentPayment(
  type: query_getDocument_payment_items_type,
): GreenInvoicePaymentType {
  switch (type) {
    case 'NEGATIVE_1':
      return 'TAX_DEDUCTION';
    case '_1':
      return 'CASH';
    case '_2':
      return 'CHEQUE';
    case '_3':
      return 'CREDIT_CARD';
    case '_4':
      return 'WIRE_TRANSFER';
    case '_5':
      return 'PAYPAL';
    case '_9':
      return 'OTHER_DEDUCTION';
    case '_10':
      return 'PAYMENT_APP';
    case '_11':
      return 'OTHER';
    default:
      throw new Error(`Unsupported payment type: ${type}`);
  }
}

export function getGreenInvoiceDocumentPaymentSubType(
  subType: GreenInvoicePaymentSubType,
): query_getDocument_payment_items_subType {
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

export function getSubTypeFromGreenInvoiceDocumentPayment(
  subType: query_getDocument_payment_items_subType,
): GreenInvoicePaymentSubType {
  switch (subType) {
    case '_1':
      return 'BITCOIN';
    case '_7':
      return 'BUYME_VOUCHER';
    case '_6':
      return 'ETHEREUM';
    case '_4':
      return 'GIFT_CARD';
    case '_2':
      return 'MONEY_EQUAL';
    case '_5':
      return 'NII_EMPLOYEE_DEDUCTION';
    case '_8':
      return 'PAYONEER';
    case '_3':
      return 'V_CHECK';
    default:
      throw new Error(`Unsupported payment sub-type: ${subType}`);
  }
}

export function getGreenInvoiceDocumentPaymentAppType(
  appType: GreenInvoicePaymentAppType,
): query_getDocument_payment_items_appType {
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

export function getPaymentAppTypeFromGreenInvoiceDocument(
  appType: query_getDocument_payment_items_appType,
): GreenInvoicePaymentAppType {
  switch (appType) {
    case '_6':
      return 'APPLE_PAY';
    case '_1':
      return 'BIT';
    case '_4':
      return 'CULO';
    case '_5':
      return 'GOOGLE_PAY';
    case '_3':
      return 'PAYBOX';
    case '_2':
      return 'PAY_BY_PEPPER';
    default:
      throw new Error(`Unsupported payment app type: ${appType}`);
  }
}

export function getGreenInvoiceDocumentPaymentCardType(
  cardType: GreenInvoicePaymentCardType,
): query_getDocument_payment_items_cardType {
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

export function getCardTypeFromGreenInvoiceDocumentPayment(
  cardType: query_getDocument_payment_items_cardType,
): GreenInvoicePaymentCardType {
  switch (cardType) {
    case '_4':
      return 'AMERICAN_EXPRESS';
    case '_5':
      return 'DINERS';
    case '_1':
      return 'ISRACARD';
    case '_3':
      return 'MASTERCARD';
    // case '_0': // TODO: why is this not supported?
    //   return 'UNKNOWN';
    case '_2':
      return 'VISA';
    default:
      throw new Error(`Unsupported payment card type: ${cardType}`);
  }
}

export function getGreenInvoiceDocumentPaymentDealType(
  dealType: GreenInvoicePaymentDealType,
): query_getDocument_payment_items_dealType {
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

export function getDealTypeFromGreenInvoiceDocumentPayment(
  dealType: query_getDocument_payment_items_dealType,
): GreenInvoicePaymentDealType {
  switch (dealType) {
    case '_3':
      return 'CREDIT';
    case '_4':
      return 'DEFERRED';
    case '_5':
      return 'OTHER';
    case '_2':
      return 'PAYMENTS';
    case '_6':
      return 'RECURRING';
    case '_1':
      return 'STANDARD';
    default:
      throw new Error(`Unsupported payment deal type: ${dealType}`);
  }
}

export function getGreenInvoiceDocumentLinkType(
  linkType: GreenInvoiceLinkType,
): queryInput_previewDocument_input_linkType {
  switch (linkType) {
    case 'CANCEL':
      return 'CANCEL';
    case 'LINK':
      return 'LINK';
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

export function greenInvoiceCountryToCountryCode(country: GreenInvoiceCountry): CountryCode {
  switch (country) {
    case 'AD':
      return CountryCode.Andorra;
    case 'AE':
      return CountryCode['United Arab Emirates (the)'];
    case 'AF':
      return CountryCode.Afghanistan;
    case 'AG':
      return CountryCode['Antigua and Barbuda'];
    case 'AI':
      return CountryCode.Anguilla;
    case 'AL':
      return CountryCode.Albania;
    case 'AM':
      return CountryCode.Armenia;
    case 'AO':
      return CountryCode.Angola;
    case 'AQ':
      return CountryCode.Antarctica;
    case 'AR':
      return CountryCode.Argentina;
    case 'AS':
      return CountryCode['American Samoa'];
    case 'AT':
      return CountryCode.Austria;
    case 'AU':
      return CountryCode.Australia;
    case 'AW':
      return CountryCode.Aruba;
    case 'AX':
      return CountryCode['Åland Islands'];
    case 'AZ':
      return CountryCode.Azerbaijan;
    case 'BA':
      return CountryCode['Bosnia and Herzegovina'];
    case 'BB':
      return CountryCode.Barbados;
    case 'BD':
      return CountryCode.Bangladesh;
    case 'BE':
      return CountryCode.Belgium;
    case 'BF':
      return CountryCode['Burkina Faso'];
    case 'BG':
      return CountryCode.Bulgaria;
    case 'BH':
      return CountryCode.Bahrain;
    case 'BI':
      return CountryCode.Burundi;
    case 'BJ':
      return CountryCode.Benin;
    case 'BL':
      return CountryCode['Saint Barthélemy'];
    case 'BM':
      return CountryCode.Bermuda;
    case 'BN':
      return CountryCode['Brunei Darussalam'];
    case 'BO':
      return CountryCode['Bolivia (Plurinational State of)'];
    case 'BQ':
      return CountryCode['Bonaire, Sint Eustatius and Saba'];
    case 'BR':
      return CountryCode.Brazil;
    case 'BS':
      return CountryCode['Bahamas (the)'];
    case 'BT':
      return CountryCode.Bhutan;
    case 'BV':
      return CountryCode['Bouvet Island'];
    case 'BW':
      return CountryCode.Botswana;
    case 'BY':
      return CountryCode.Belarus;
    case 'BZ':
      return CountryCode.Belize;
    case 'CA':
      return CountryCode.Canada;
    case 'CC':
      return CountryCode['Cocos (Keeling) Islands (the)'];
    case 'CD':
      return CountryCode['Congo (the Democratic Republic of the)'];
    case 'CF':
      return CountryCode['Central African Republic (the)'];
    case 'CG':
      return CountryCode['Congo (the)'];
    case 'CH':
      return CountryCode.Switzerland;
    case 'CI':
      return CountryCode["Côte d'Ivoire"];
    case 'CK':
      return CountryCode['Cook Islands (the)'];
    case 'CL':
      return CountryCode.Chile;
    case 'CM':
      return CountryCode.Cameroon;
    case 'CN':
      return CountryCode.China;
    case 'CO':
      return CountryCode.Colombia;
    case 'CR':
      return CountryCode['Costa Rica'];
    case 'CU':
      return CountryCode.Cuba;
    case 'CV':
      return CountryCode['Cabo Verde'];
    case 'CW':
      return CountryCode.Curaçao;
    case 'CX':
      return CountryCode['Christmas Island'];
    case 'CY':
      return CountryCode.Cyprus;
    case 'CZ':
      return CountryCode.Czechia;
    case 'DE':
      return CountryCode.Germany;
    case 'DJ':
      return CountryCode.Djibouti;
    case 'DK':
      return CountryCode.Denmark;
    case 'DM':
      return CountryCode.Dominica;
    case 'DO':
      return CountryCode['Dominican Republic (the)'];
    case 'DZ':
      return CountryCode.Algeria;
    case 'EC':
      return CountryCode.Ecuador;
    case 'EE':
      return CountryCode.Estonia;
    case 'EG':
      return CountryCode.Egypt;
    case 'EH':
      return CountryCode['Western Sahara'];
    case 'ER':
      return CountryCode.Eritrea;
    case 'ES':
      return CountryCode.Spain;
    case 'ET':
      return CountryCode.Ethiopia;
    case 'FI':
      return CountryCode.Finland;
    case 'FJ':
      return CountryCode.Fiji;
    case 'FK':
      return CountryCode['Falkland Islands (the) [Malvinas]'];
    case 'FM':
      return CountryCode['Micronesia (Federated States of)'];
    case 'FO':
      return CountryCode['Faroe Islands (the)'];
    case 'FR':
      return CountryCode.France;
    case 'GA':
      return CountryCode.Gabon;
    case 'GB':
      return CountryCode['United Kingdom of Great Britain and Northern Ireland (the)'];
    case 'GD':
      return CountryCode.Grenada;
    case 'GE':
      return CountryCode.Georgia;
    case 'GF':
      return CountryCode['French Guiana'];
    case 'GG':
      return CountryCode.Guernsey;
    case 'GH':
      return CountryCode.Ghana;
    case 'GI':
      return CountryCode.Gibraltar;
    case 'GL':
      return CountryCode.Greenland;
    case 'GM':
      return CountryCode['Gambia (the)'];
    case 'GN':
      return CountryCode.Guinea;
    case 'GP':
      return CountryCode.Guadeloupe;
    case 'GQ':
      return CountryCode['Equatorial Guinea'];
    case 'GR':
      return CountryCode.Greece;
    case 'GS':
      return CountryCode['South Georgia and the South Sandwich Islands'];
    case 'GT':
      return CountryCode.Guatemala;
    case 'GU':
      return CountryCode.Guam;
    case 'GW':
      return CountryCode['Guinea-Bissau'];
    case 'GY':
      return CountryCode.Guyana;
    case 'HK':
      return CountryCode['Hong Kong'];
    case 'HM':
      return CountryCode['Heard Island and McDonald Islands'];
    case 'HN':
      return CountryCode.Honduras;
    case 'HR':
      return CountryCode.Croatia;
    case 'HT':
      return CountryCode.Haiti;
    case 'HU':
      return CountryCode.Hungary;
    case 'ID':
      return CountryCode.Indonesia;
    case 'IE':
      return CountryCode.Ireland;
    case 'IL':
      return CountryCode.Israel;
    case 'IM':
      return CountryCode['Isle of Man'];
    case 'IN':
      return CountryCode.India;
    case 'IO':
      return CountryCode['British Indian Ocean Territory (the)'];
    case 'IQ':
      return CountryCode.Iraq;
    case 'IR':
      return CountryCode['Iran (Islamic Republic of)'];
    case 'IS':
      return CountryCode.Iceland;
    case 'IT':
      return CountryCode.Italy;
    case 'JE':
      return CountryCode.Jersey;
    case 'JM':
      return CountryCode.Jamaica;
    case 'JO':
      return CountryCode.Jordan;
    case 'JP':
      return CountryCode.Japan;
    case 'KE':
      return CountryCode.Kenya;
    case 'KG':
      return CountryCode.Kyrgyzstan;
    case 'KH':
      return CountryCode.Cambodia;
    case 'KI':
      return CountryCode.Kiribati;
    case 'KM':
      return CountryCode['Comoros (the)'];
    case 'KN':
      return CountryCode['Saint Kitts and Nevis'];
    case 'KP':
      return CountryCode["Korea (the Democratic People's Republic of)"];
    case 'KR':
      return CountryCode['Korea (the Republic of)'];
    case 'KW':
      return CountryCode.Kuwait;
    case 'KY':
      return CountryCode['Cayman Islands (the)'];
    case 'KZ':
      return CountryCode.Kazakhstan;
    case 'LA':
      return CountryCode["Lao People's Democratic Republic (the)"];
    case 'LB':
      return CountryCode.Lebanon;
    case 'LC':
      return CountryCode['Saint Lucia'];
    case 'LI':
      return CountryCode.Liechtenstein;
    case 'LK':
      return CountryCode['Sri Lanka'];
    case 'LR':
      return CountryCode.Liberia;
    case 'LS':
      return CountryCode.Lesotho;
    case 'LT':
      return CountryCode.Lithuania;
    case 'LU':
      return CountryCode.Luxembourg;
    case 'LV':
      return CountryCode.Latvia;
    case 'LY':
      return CountryCode.Libya;
    case 'MA':
      return CountryCode.Morocco;
    case 'MC':
      return CountryCode.Monaco;
    case 'MD':
      return CountryCode['Moldova (the Republic of)'];
    case 'ME':
      return CountryCode.Montenegro;
    case 'MF':
      return CountryCode['Saint Martin (French part)'];
    case 'MG':
      return CountryCode.Madagascar;
    case 'MH':
      return CountryCode['Marshall Islands (the)'];
    case 'MK':
      return CountryCode['Republic of North Macedonia'];
    case 'ML':
      return CountryCode.Mali;
    case 'MM':
      return CountryCode.Myanmar;
    case 'MN':
      return CountryCode.Mongolia;
    case 'MO':
      return CountryCode.Macao;
    case 'MP':
      return CountryCode['Northern Mariana Islands (the)'];
    case 'MQ':
      return CountryCode.Martinique;
    case 'MR':
      return CountryCode.Mauritania;
    case 'MS':
      return CountryCode.Montserrat;
    case 'MT':
      return CountryCode.Malta;
    case 'MU':
      return CountryCode.Mauritius;
    case 'MV':
      return CountryCode.Maldives;
    case 'MW':
      return CountryCode.Malawi;
    case 'MX':
      return CountryCode.Mexico;
    case 'MY':
      return CountryCode.Malaysia;
    case 'MZ':
      return CountryCode.Mozambique;
    case 'NA':
      return CountryCode.Namibia;
    case 'NC':
      return CountryCode['New Caledonia'];
    case 'NE':
      return CountryCode['Niger (the)'];
    case 'NF':
      return CountryCode['Norfolk Island'];
    case 'NG':
      return CountryCode.Nigeria;
    case 'NI':
      return CountryCode.Nicaragua;
    case 'NL':
      return CountryCode['Netherlands (the)'];
    case 'NO':
      return CountryCode.Norway;
    case 'NP':
      return CountryCode.Nepal;
    case 'NR':
      return CountryCode.Nauru;
    case 'NU':
      return CountryCode.Niue;
    case 'NZ':
      return CountryCode['New Zealand'];
    case 'OM':
      return CountryCode.Oman;
    case 'PA':
      return CountryCode.Panama;
    case 'PE':
      return CountryCode.Peru;
    case 'PF':
      return CountryCode['French Polynesia'];
    case 'PG':
      return CountryCode['Papua New Guinea'];
    case 'PH':
      return CountryCode['Philippines (the)'];
    case 'PK':
      return CountryCode.Pakistan;
    case 'PL':
      return CountryCode.Poland;
    case 'PM':
      return CountryCode['Saint Pierre and Miquelon'];
    case 'PN':
      return CountryCode.Pitcairn;
    case 'PR':
      return CountryCode['Puerto Rico'];
    case 'PS':
      return CountryCode['Palestine, State of'];
    case 'PT':
      return CountryCode.Portugal;
    case 'PW':
      return CountryCode.Palau;
    case 'PY':
      return CountryCode.Paraguay;
    case 'QA':
      return CountryCode.Qatar;
    case 'RE':
      return CountryCode.Réunion;
    case 'RO':
      return CountryCode.Romania;
    case 'RS':
      return CountryCode.Serbia;
    case 'RU':
      return CountryCode['Russian Federation (the)'];
    case 'RW':
      return CountryCode.Rwanda;
    case 'SA':
      return CountryCode['Saudi Arabia'];
    case 'SB':
      return CountryCode['Solomon Islands'];
    case 'SC':
      return CountryCode.Seychelles;
    case 'SD':
      return CountryCode['Sudan (the)'];
    case 'SE':
      return CountryCode.Sweden;
    case 'SG':
      return CountryCode.Singapore;
    case 'SH':
      return CountryCode['Saint Helena, Ascension and Tristan da Cunha'];
    case 'SI':
      return CountryCode.Slovenia;
    case 'SJ':
      return CountryCode['Svalbard and Jan Mayen'];
    case 'SK':
      return CountryCode.Slovakia;
    case 'SL':
      return CountryCode['Sierra Leone'];
    case 'SM':
      return CountryCode['San Marino'];
    case 'SN':
      return CountryCode.Senegal;
    case 'SO':
      return CountryCode.Somalia;
    case 'SR':
      return CountryCode.Suriname;
    case 'SS':
      return CountryCode['South Sudan'];
    case 'ST':
      return CountryCode['Sao Tome and Principe'];
    case 'SV':
      return CountryCode['El Salvador'];
    case 'SX':
      return CountryCode['Sint Maarten (Dutch part)'];
    case 'SY':
      return CountryCode['Syrian Arab Republic'];
    case 'SZ':
      return CountryCode.Eswatini;
    case 'TC':
      return CountryCode['Turks and Caicos Islands (the)'];
    case 'TD':
      return CountryCode.Chad;
    case 'TF':
      return CountryCode['French Southern Territories (the)'];
    case 'TG':
      return CountryCode.Togo;
    case 'TH':
      return CountryCode.Thailand;
    case 'TJ':
      return CountryCode.Tajikistan;
    case 'TK':
      return CountryCode.Tokelau;
    case 'TL':
      return CountryCode['Timor-Leste'];
    case 'TM':
      return CountryCode.Turkmenistan;
    case 'TN':
      return CountryCode.Tunisia;
    case 'TO':
      return CountryCode.Tonga;
    case 'TR':
      return CountryCode.Turkey;
    case 'TT':
      return CountryCode['Trinidad and Tobago'];
    case 'TV':
      return CountryCode.Tuvalu;
    case 'TW':
      return CountryCode['Taiwan (Province of China)'];
    case 'TZ':
      return CountryCode['Tanzania, United Republic of'];
    case 'UA':
      return CountryCode.Ukraine;
    case 'UG':
      return CountryCode.Uganda;
    case 'UM':
      return CountryCode['United States Minor Outlying Islands (the)'];
    case 'US':
      return CountryCode['United States of America (the)'];
    case 'UY':
      return CountryCode.Uruguay;
    case 'UZ':
      return CountryCode.Uzbekistan;
    case 'VA':
      return CountryCode['Holy See (the)'];
    case 'VC':
      return CountryCode['Saint Vincent and the Grenadines'];
    case 'VE':
      return CountryCode['Venezuela (Bolivarian Republic of)'];
    case 'VG':
      return CountryCode['Virgin Islands (British)'];
    case 'VI':
      return CountryCode['Virgin Islands (U.S.)'];
    case 'VN':
      return CountryCode['Viet Nam'];
    case 'VU':
      return CountryCode.Vanuatu;
    case 'WF':
      return CountryCode['Wallis and Futuna'];
    case 'WS':
      return CountryCode.Samoa;
    case 'YE':
      return CountryCode.Yemen;
    case 'YT':
      return CountryCode.Mayotte;
    case 'ZA':
      return CountryCode['South Africa'];
    case 'ZM':
      return CountryCode.Zambia;
    case 'ZW':
      return CountryCode.Zimbabwe;
    case 'XK':
      // TODO: remove this once green invoice adds Kosovo to their list
      return CountryCode.Serbia;
    default:
      throw new Error(`Unsupported Green Invoice country: ${country}`);
  }
}

export function countryCodeToGreenInvoiceCountry(countryCode: CountryCode): GreenInvoiceCountry {
  switch (countryCode) {
    case CountryCode.Afghanistan:
      return 'AF';
    case CountryCode['Åland Islands']:
      return 'AX';
    case CountryCode.Albania:
      return 'AL';
    case CountryCode.Algeria:
      return 'DZ';
    case CountryCode['American Samoa']:
      return 'AS';
    case CountryCode.Andorra:
      return 'AD';
    case CountryCode.Angola:
      return 'AO';
    case CountryCode.Anguilla:
      return 'AI';
    case CountryCode.Antarctica:
      return 'AQ';
    case CountryCode['Antigua and Barbuda']:
      return 'AG';
    case CountryCode.Argentina:
      return 'AR';
    case CountryCode.Armenia:
      return 'AM';
    case CountryCode.Aruba:
      return 'AW';
    case CountryCode.Australia:
      return 'AU';
    case CountryCode.Austria:
      return 'AT';
    case CountryCode.Azerbaijan:
      return 'AZ';
    case CountryCode['Bahamas (the)']:
      return 'BS';
    case CountryCode.Bahrain:
      return 'BH';
    case CountryCode.Bangladesh:
      return 'BD';
    case CountryCode.Barbados:
      return 'BB';
    case CountryCode.Belarus:
      return 'BY';
    case CountryCode.Belgium:
      return 'BE';
    case CountryCode.Belize:
      return 'BZ';
    case CountryCode.Benin:
      return 'BJ';
    case CountryCode.Bermuda:
      return 'BM';
    case CountryCode.Bhutan:
      return 'BT';
    case CountryCode['Bolivia (Plurinational State of)']:
      return 'BO';
    case CountryCode['Bonaire, Sint Eustatius and Saba']:
      return 'BQ';
    case CountryCode['Bosnia and Herzegovina']:
      return 'BA';
    case CountryCode.Botswana:
      return 'BW';
    case CountryCode['Bouvet Island']:
      return 'BV';
    case CountryCode.Brazil:
      return 'BR';
    case CountryCode['British Indian Ocean Territory (the)']:
      return 'IO';
    case CountryCode['Brunei Darussalam']:
      return 'BN';
    case CountryCode.Bulgaria:
      return 'BG';
    case CountryCode['Burkina Faso']:
      return 'BF';
    case CountryCode.Burundi:
      return 'BI';
    case CountryCode['Cabo Verde']:
      return 'CV';
    case CountryCode.Cambodia:
      return 'KH';
    case CountryCode.Cameroon:
      return 'CM';
    case CountryCode.Canada:
      return 'CA';
    case CountryCode['Cayman Islands (the)']:
      return 'KY';
    case CountryCode['Central African Republic (the)']:
      return 'CF';
    case CountryCode.Chad:
      return 'TD';
    case CountryCode.Chile:
      return 'CL';
    case CountryCode.China:
      return 'CN';
    case CountryCode['Christmas Island']:
      return 'CX';
    case CountryCode['Cocos (Keeling) Islands (the)']:
      return 'CC';
    case CountryCode.Colombia:
      return 'CO';
    case CountryCode['Comoros (the)']:
      return 'KM';
    case CountryCode['Congo (the Democratic Republic of the)']:
      return 'CD';
    case CountryCode['Congo (the)']:
      return 'CG';
    case CountryCode['Cook Islands (the)']:
      return 'CK';
    case CountryCode['Costa Rica']:
      return 'CR';
    case CountryCode.Croatia:
      return 'HR';
    case CountryCode.Cuba:
      return 'CU';
    case CountryCode.Curaçao:
      return 'CW';
    case CountryCode.Cyprus:
      return 'CY';
    case CountryCode.Czechia:
      return 'CZ';
    case CountryCode["Côte d'Ivoire"]:
      return 'CI';
    case CountryCode.Denmark:
      return 'DK';
    case CountryCode.Djibouti:
      return 'DJ';
    case CountryCode.Dominica:
      return 'DM';
    case CountryCode['Dominican Republic (the)']:
      return 'DO';
    case CountryCode.Ecuador:
      return 'EC';
    case CountryCode.Egypt:
      return 'EG';
    case CountryCode['El Salvador']:
      return 'SV';
    case CountryCode['Equatorial Guinea']:
      return 'GQ';
    case CountryCode.Eritrea:
      return 'ER';
    case CountryCode.Estonia:
      return 'EE';
    case CountryCode.Eswatini:
      return 'SZ';
    case CountryCode.Ethiopia:
      return 'ET';
    case CountryCode['Falkland Islands (the) [Malvinas]']:
      return 'FK';
    case CountryCode['Faroe Islands (the)']:
      return 'FO';
    case CountryCode.Fiji:
      return 'FJ';
    case CountryCode.Finland:
      return 'FI';
    case CountryCode.France:
      return 'FR';
    case CountryCode['French Guiana']:
      return 'GF';
    case CountryCode['French Polynesia']:
      return 'PF';
    case CountryCode['French Southern Territories (the)']:
      return 'TF';
    case CountryCode.Gabon:
      return 'GA';
    case CountryCode['Gambia (the)']:
      return 'GM';
    case CountryCode.Georgia:
      return 'GE';
    case CountryCode.Germany:
      return 'DE';
    case CountryCode.Ghana:
      return 'GH';
    case CountryCode.Gibraltar:
      return 'GI';
    case CountryCode.Greece:
      return 'GR';
    case CountryCode.Greenland:
      return 'GL';
    case CountryCode.Grenada:
      return 'GD';
    case CountryCode.Guadeloupe:
      return 'GP';
    case CountryCode.Guam:
      return 'GU';
    case CountryCode.Guatemala:
      return 'GT';
    case CountryCode.Guernsey:
      return 'GG';
    case CountryCode.Guinea:
      return 'GN';
    case CountryCode['Guinea-Bissau']:
      return 'GW';
    case CountryCode.Guyana:
      return 'GY';
    case CountryCode.Haiti:
      return 'HT';
    case CountryCode['Heard Island and McDonald Islands']:
      return 'HM';
    case CountryCode['Holy See (the)']:
      return 'VA';
    case CountryCode.Honduras:
      return 'HN';
    case CountryCode['Hong Kong']:
      return 'HK';
    case CountryCode.Hungary:
      return 'HU';
    case CountryCode.Iceland:
      return 'IS';
    case CountryCode.India:
      return 'IN';
    case CountryCode.Indonesia:
      return 'ID';
    case CountryCode['Iran (Islamic Republic of)']:
      return 'IR';
    case CountryCode.Iraq:
      return 'IQ';
    case CountryCode.Ireland:
      return 'IE';
    case CountryCode['Isle of Man']:
      return 'IM';
    case CountryCode.Israel:
      return 'IL';
    case CountryCode.Italy:
      return 'IT';
    case CountryCode.Jamaica:
      return 'JM';
    case CountryCode.Japan:
      return 'JP';
    case CountryCode.Jersey:
      return 'JE';
    case CountryCode.Jordan:
      return 'JO';
    case CountryCode.Kazakhstan:
      return 'KZ';
    case CountryCode.Kenya:
      return 'KE';
    case CountryCode.Kiribati:
      return 'KI';
    case CountryCode["Korea (the Democratic People's Republic of)"]:
      return 'KP';
    case CountryCode['Korea (the Republic of)']:
      return 'KR';
    case CountryCode.Kuwait:
      return 'KW';
    case CountryCode.Kyrgyzstan:
      return 'KG';
    case CountryCode["Lao People's Democratic Republic (the)"]:
      return 'LA';
    case CountryCode.Latvia:
      return 'LV';
    case CountryCode.Lebanon:
      return 'LB';
    case CountryCode.Lesotho:
      return 'LS';
    case CountryCode.Liberia:
      return 'LR';
    case CountryCode.Libya:
      return 'LY';
    case CountryCode.Liechtenstein:
      return 'LI';
    case CountryCode.Lithuania:
      return 'LT';
    case CountryCode.Luxembourg:
      return 'LU';
    case CountryCode.Macao:
      return 'MO';
    case CountryCode.Madagascar:
      return 'MG';
    case CountryCode.Malawi:
      return 'MW';
    case CountryCode.Malaysia:
      return 'MY';
    case CountryCode.Maldives:
      return 'MV';
    case CountryCode.Mali:
      return 'ML';
    case CountryCode.Malta:
      return 'MT';
    case CountryCode['Marshall Islands (the)']:
      return 'MH';
    case CountryCode.Martinique:
      return 'MQ';
    case CountryCode.Mauritania:
      return 'MR';
    case CountryCode.Mauritius:
      return 'MU';
    case CountryCode.Mayotte:
      return 'YT';
    case CountryCode.Mexico:
      return 'MX';
    case CountryCode['Micronesia (Federated States of)']:
      return 'FM';
    case CountryCode['Moldova (the Republic of)']:
      return 'MD';
    case CountryCode.Monaco:
      return 'MC';
    case CountryCode.Mongolia:
      return 'MN';
    case CountryCode.Montenegro:
      return 'ME';
    case CountryCode.Montserrat:
      return 'MS';
    case CountryCode.Morocco:
      return 'MA';
    case CountryCode.Mozambique:
      return 'MZ';
    case CountryCode.Myanmar:
      return 'MM';
    case CountryCode.Namibia:
      return 'NA';
    case CountryCode.Nauru:
      return 'NR';
    case CountryCode.Nepal:
      return 'NP';
    case CountryCode['Netherlands (the)']:
      return 'NL';
    case CountryCode['New Caledonia']:
      return 'NC';
    case CountryCode['New Zealand']:
      return 'NZ';
    case CountryCode.Nicaragua:
      return 'NI';
    case CountryCode['Niger (the)']:
      return 'NE';
    case CountryCode.Nigeria:
      return 'NG';
    case CountryCode.Niue:
      return 'NU';
    case CountryCode['Norfolk Island']:
      return 'NF';
    case CountryCode['Northern Mariana Islands (the)']:
      return 'MP';
    case CountryCode.Norway:
      return 'NO';
    case CountryCode.Oman:
      return 'OM';
    case CountryCode.Pakistan:
      return 'PK';
    case CountryCode.Palau:
      return 'PW';
    case CountryCode['Palestine, State of']:
      return 'PS';
    case CountryCode.Panama:
      return 'PA';
    case CountryCode['Papua New Guinea']:
      return 'PG';
    case CountryCode.Paraguay:
      return 'PY';
    case CountryCode.Peru:
      return 'PE';
    case CountryCode['Philippines (the)']:
      return 'PH';
    case CountryCode.Pitcairn:
      return 'PN';
    case CountryCode.Poland:
      return 'PL';
    case CountryCode.Portugal:
      return 'PT';
    case CountryCode['Puerto Rico']:
      return 'PR';
    case CountryCode.Qatar:
      return 'QA';
    case CountryCode['Republic of North Macedonia']:
      return 'MK';
    case CountryCode.Romania:
      return 'RO';
    case CountryCode['Russian Federation (the)']:
      return 'RU';
    case CountryCode.Rwanda:
      return 'RW';
    case CountryCode.Réunion:
      return 'RE';
    case CountryCode['Saint Barthélemy']:
      return 'BL';
    case CountryCode['Saint Helena, Ascension and Tristan da Cunha']:
      return 'SH';
    case CountryCode['Saint Kitts and Nevis']:
      return 'KN';
    case CountryCode['Saint Lucia']:
      return 'LC';
    case CountryCode['Saint Martin (French part)']:
      return 'MF';
    case CountryCode['Saint Pierre and Miquelon']:
      return 'PM';
    case CountryCode['Saint Vincent and the Grenadines']:
      return 'VC';
    case CountryCode.Samoa:
      return 'WS';
    case CountryCode['San Marino']:
      return 'SM';
    case CountryCode['Sao Tome and Principe']:
      return 'ST';
    case CountryCode['Saudi Arabia']:
      return 'SA';
    case CountryCode.Senegal:
      return 'SN';
    case CountryCode.Serbia:
      return 'RS';
    case CountryCode.Seychelles:
      return 'SC';
    case CountryCode['Sierra Leone']:
      return 'SL';
    case CountryCode.Singapore:
      return 'SG';
    case CountryCode['Sint Maarten (Dutch part)']:
      return 'SX';
    case CountryCode.Slovakia:
      return 'SK';
    case CountryCode.Slovenia:
      return 'SI';
    case CountryCode['Solomon Islands']:
      return 'SB';
    case CountryCode.Somalia:
      return 'SO';
    case CountryCode['South Africa']:
      return 'ZA';
    case CountryCode['South Georgia and the South Sandwich Islands']:
      return 'GS';
    case CountryCode['South Sudan']:
      return 'SS';
    case CountryCode.Spain:
      return 'ES';
    case CountryCode['Sri Lanka']:
      return 'LK';
    case CountryCode['Sudan (the)']:
      return 'SD';
    case CountryCode.Suriname:
      return 'SR';
    case CountryCode['Svalbard and Jan Mayen']:
      return 'SJ';
    case CountryCode.Sweden:
      return 'SE';
    case CountryCode.Switzerland:
      return 'CH';
    case CountryCode['Syrian Arab Republic']:
      return 'SY';
    case CountryCode['Taiwan (Province of China)']:
      return 'TW';
    case CountryCode.Tajikistan:
      return 'TJ';
    case CountryCode['Tanzania, United Republic of']:
      return 'TZ';
    case CountryCode.Thailand:
      return 'TH';
    case CountryCode['Timor-Leste']:
      return 'TL';
    case CountryCode.Togo:
      return 'TG';
    case CountryCode.Tokelau:
      return 'TK';
    case CountryCode.Tonga:
      return 'TO';
    case CountryCode['Trinidad and Tobago']:
      return 'TT';
    case CountryCode.Tunisia:
      return 'TN';
    case CountryCode.Turkey:
      return 'TR';
    case CountryCode.Turkmenistan:
      return 'TM';
    case CountryCode['Turks and Caicos Islands (the)']:
      return 'TC';
    case CountryCode.Tuvalu:
      return 'TV';
    case CountryCode.Uganda:
      return 'UG';
    case CountryCode.Ukraine:
      return 'UA';
    case CountryCode['United Arab Emirates (the)']:
      return 'AE';
    case CountryCode['United Kingdom of Great Britain and Northern Ireland (the)']:
      return 'GB';
    case CountryCode['United States Minor Outlying Islands (the)']:
      return 'UM';
    case CountryCode['United States of America (the)']:
      return 'US';
    case CountryCode.Uruguay:
      return 'UY';
    case CountryCode.Uzbekistan:
      return 'UZ';
    case CountryCode.Vanuatu:
      return 'VU';
    case CountryCode['Venezuela (Bolivarian Republic of)']:
      return 'VE';
    case CountryCode['Viet Nam']:
      return 'VN';
    case CountryCode['Virgin Islands (British)']:
      return 'VG';
    case CountryCode['Virgin Islands (U.S.)']:
      return 'VI';
    case CountryCode['Wallis and Futuna']:
      return 'WF';
    case CountryCode['Western Sahara']:
      return 'EH';
    case CountryCode.Yemen:
      return 'YE';
    case CountryCode.Zambia:
      return 'ZM';
    case CountryCode.Zimbabwe:
      return 'ZW';
    default:
      throw new Error(`Unsupported country code: ${countryCode}`);
  }
}

export function greenInvoiceToDocumentStatus(greenInvoiceStatus: number): document_status {
  switch (greenInvoiceStatus) {
    case 0:
      return 'OPEN';
    case 1:
      return 'CLOSED';
    case 2:
      return 'MANUALLY_CLOSED';
    case 3:
      return 'CANCELLED_BY_OTHER_DOC';
    case 4:
      return 'CANCELLED';
    default:
      throw new Error(`Unsupported Green Invoice document status: ${greenInvoiceStatus}`);
  }
}

export async function getLinkedDocuments(
  injector: Injector,
  externalDocumentId: string,
): Promise<string[] | null> {
  const greenInvoiceDocument = await injector
    .get(GreenInvoiceClientProvider)
    .documentLoader.load(externalDocumentId);
  if (!greenInvoiceDocument?.linkedDocuments) {
    return null;
  }

  const linkedDocuments = greenInvoiceDocument.linkedDocuments.filter(
    Boolean,
  ) as _DOLLAR_defs_DocumentLinkedDocument[];
  if (!linkedDocuments.length) {
    return null;
  }

  const linkedDocumentsIds: string[] = [];
  await Promise.all(
    linkedDocuments.map(async linkedDocument => {
      const issuedDocument = await injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByExternalIdLoader.load(linkedDocument.id);

      if (!issuedDocument?.id) {
        throw new GraphQLError(
          `Linked document with ID ${linkedDocument.id} not found in issued documents`,
        );
      }

      linkedDocumentsIds.push(issuedDocument.id);
    }),
  );

  return linkedDocumentsIds;
}

export async function insertNewDocumentFromGreenInvoice(
  injector: Injector,
  greenInvoiceDoc: _DOLLAR_defs_Document,
  ownerId: string,
  preDictatedChargeId?: string | null,
) {
  const documentType = normalizeDocumentType(greenInvoiceDoc.type);
  const isOwnerCreditor = greenInvoiceDoc.amount > 0 && documentType !== DocumentType.CreditInvoice;

  try {
    // generate preview image via cloudinary
    const imagePromise = injector
      .get(CloudinaryProvider)
      .uploadInvoiceToCloudinary(greenInvoiceDoc.url.origin);

    // Get matching business
    const clientPromise = greenInvoiceDoc.client.id
      ? injector
          .get(ClientsProvider)
          .getClientByGreenInvoiceIdLoader.load(greenInvoiceDoc.client.id)
      : Promise.resolve(null);

    const linkedDocumentsPromise = getLinkedDocuments(injector, greenInvoiceDoc.id);

    const fileHashPromise = async () => {
      try {
        // Before creating rawDocument
        const fileResponse = await fetch(greenInvoiceDoc.url.origin);
        if (!fileResponse.ok) {
          // Handle error, maybe log and continue with null hash
          throw new Error(`Failed to fetch file from GreenInvoice: ${greenInvoiceDoc.url.origin}`);
        }
        const fileContent = await fileResponse.text();
        const fileHash = hashStringToInt(fileContent).toString();
        return fileHash;
      } catch (error) {
        console.error('Error fetching file for hash calculation:', error);
        return null;
      }
    };

    const [{ imageUrl }, client, linkedDocumentIds, fileHash] = await Promise.all([
      imagePromise,
      clientPromise,
      linkedDocumentsPromise,
      fileHashPromise(),
    ]);

    let chargeId: string | null = preDictatedChargeId || null;
    // if linked documents exist, use the first one to get the charge ID
    if (!chargeId && linkedDocumentIds?.length) {
      const linkedDocId = linkedDocumentIds[0];
      const document = await injector
        .get(DocumentsProvider)
        .getDocumentsByIdLoader.load(linkedDocId);

      if (document?.charge_id) {
        chargeId = document.charge_id;
      }
    }

    if (!chargeId) {
      // Generate new parent charge

      let userDescription = 'Green Invoice generated charge';

      const income = greenInvoiceDoc.income;
      if (income && income.length > 0 && income[0]!.description && income[0]!.description !== '') {
        userDescription = income
          .filter(item => item?.description)
          .map(item => item!.description)
          .join(', ');
      } else if (greenInvoiceDoc.description && greenInvoiceDoc.description !== '') {
        userDescription = greenInvoiceDoc.description;
      }

      const [charge] = await injector.get(ChargesProvider).generateCharge({
        ownerId,
        userDescription,
      });
      if (!charge) {
        throw new Error('Failed to generate charge');
      }
      chargeId = charge.id;
    }

    const counterpartyId = client?.business_id ?? null;

    // insert document
    const rawDocument: IInsertDocumentsParams['document']['0'] = {
      image: imageUrl,
      file: greenInvoiceDoc.url.origin,
      documentType,
      serialNumber: greenInvoiceDoc.number,
      date: greenInvoiceDoc.documentDate,
      amount: greenInvoiceDoc.amount,
      currencyCode: formatCurrency(greenInvoiceDoc.currency),
      vat: greenInvoiceDoc.vat,
      chargeId,
      vatReportDateOverride: null,
      noVatAmount: null,
      creditorId: isOwnerCreditor ? ownerId : counterpartyId,
      debtorId: isOwnerCreditor ? counterpartyId : ownerId,
      allocationNumber: null, // TODO: add allocation number from GreenInvoice API
      exchangeRateOverride: null,
      fileHash,
    };

    const newDocumentResponse = await injector
      .get(DocumentsProvider)
      .insertDocuments({ document: [rawDocument] });
    if (!newDocumentResponse || newDocumentResponse.length === 0) {
      throw new Error('Failed to insert document');
    }
    const newDocument = newDocumentResponse[0];

    // insert issued document
    await injector
      .get(IssuedDocumentsProvider)
      .insertIssuedDocuments({
        issuedDocuments: [
          {
            external_id: greenInvoiceDoc.id,
            id: newDocument.id,
            status: greenInvoiceToDocumentStatus(greenInvoiceDoc.status),
            linked_document_ids: linkedDocumentIds,
          },
        ],
      })
      .catch(e => {
        console.error('Failed to insert issued document', e);
        throw new GraphQLError(
          `Failed to insert issued document for Green Invoice ID: ${greenInvoiceDoc.id}`,
        );
      });

    return newDocument;
  } catch (e) {
    throw new GraphQLError(
      `Error adding Green Invoice document: ${e}\n\n${JSON.stringify(greenInvoiceDoc, null, 2)}`,
    );
  }
}

export async function getGreenInvoiceDocuments(injector: Injector, recursive: boolean = false) {
  const documents: _DOLLAR_defs_Document[] = [];
  async function getDocuments(page: number = 1) {
    const data = await injector.get(GreenInvoiceClientProvider).searchDocuments({
      input: { pageSize: 100, sort: 'creationDate', page },
    });
    if (!data?.items) {
      if (!recursive) {
        throw new GraphQLError('Failed to fetch documents');
      }
      return;
    }

    documents.push(...data.items.filter(item => item !== null));

    if (data.items.length < 100) {
      return;
    }

    if (recursive) {
      await getDocuments(page + 1);
    }
  }

  await getDocuments();

  return documents;
}

export async function convertDocumentInputIntoGreenInvoiceInput(
  initialInput: NewDocumentInput,
  injector: Injector,
): Promise<_DOLLAR_defs_DocumentInputNew_Input> {
  let client: _DOLLAR_defs_addDocumentRequest_Input['client'] | undefined = undefined;
  if (initialInput.client) {
    const clientInfo = await injector
      .get(ClientsProvider)
      .getClientByIdLoader.load(initialInput.client.id);
    if (!clientInfo) {
      throw new GraphQLError(`Client with ID ${initialInput.client.id} not found in Green Invoice`);
    }
    const greenInvoiceClient = await injector
      .get(GreenInvoiceClientProvider)
      .clientLoader.load(clientInfo.green_invoice_id);
    if (!greenInvoiceClient) {
      throw new GraphQLError(
        `Green Invoice client with ID ${clientInfo.green_invoice_id} not found`,
      );
    }
    const emails: (string | null)[] = ['ap@the-guild.dev'];
    const inputEmails = initialInput.client?.emails?.filter(Boolean) ?? [];
    if (inputEmails.length) {
      emails.push(...inputEmails);
    } else {
      emails.push(...(greenInvoiceClient.emails ?? []));
    }
    client = {
      id: clientInfo.green_invoice_id,
      country: greenInvoiceClient.country,
      name: greenInvoiceClient.name,
      phone: greenInvoiceClient.phone,
      taxId: greenInvoiceClient.taxId,
      self: false,
      address: greenInvoiceClient.address,
      city: greenInvoiceClient.city,
      zip: greenInvoiceClient.zip,
      fax: greenInvoiceClient.fax,
      mobile: greenInvoiceClient.mobile,
      emails,
    };
  }
  return {
    ...initialInput,
    currency: convertCurrencyToGreenInvoice(initialInput.currency),
    type: getGreenInvoiceDocumentType(initialInput.type),
    lang: getGreenInvoiceDocumentLanguage(initialInput.lang),
    vatType: getGreenInvoiceDocumentVatType(initialInput.vatType ?? 'DEFAULT'),
    discount: initialInput.discount
      ? {
          ...initialInput.discount,
          type: getGreenInvoiceDocumentDiscountType(initialInput.discount.type),
        }
      : undefined,
    client,
    income:
      initialInput.income?.map(income => ({
        ...income,
        currency: convertCurrencyToGreenInvoice(income.currency),
        vatType: getGreenInvoiceDocumentVatType(income.vatType ?? 'DEFAULT'),
      })) ?? [],
    payment: initialInput.payment?.map(payment => ({
      ...payment,
      type: getGreenInvoiceDocumentPaymentType(payment.type),
      subType: payment.subType ? getGreenInvoiceDocumentPaymentSubType(payment.subType) : undefined,
      appType: payment.appType ? getGreenInvoiceDocumentPaymentAppType(payment.appType) : undefined,
      cardType: payment.cardType
        ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
        : undefined,
      dealType: payment.dealType
        ? getGreenInvoiceDocumentPaymentDealType(payment.dealType)
        : undefined,
      currency: convertCurrencyToGreenInvoice(payment.currency),
    })),
    linkedDocumentIds: initialInput.linkedDocumentIds?.length
      ? [...initialInput.linkedDocumentIds]
      : undefined,
    linkType: initialInput.linkType
      ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
      : undefined,
  };
}

export function convertGreenInvoiceDocumentToLocalDocumentInfo(
  greenInvoiceDocument: _DOLLAR_defs_Document,
): NewDocumentInfo {
  return {
    ...greenInvoiceDocument,
    client: greenInvoiceDocument.client?.id
      ? {
          ...greenInvoiceDocument.client,
          id: greenInvoiceDocument.client.id,
          emails: greenInvoiceDocument.client.emails
            ? (greenInvoiceDocument.client.emails.filter(Boolean) as string[])
            : [],
        }
      : undefined,
    currency: greenInvoiceDocument.currency as Currency,
    income: greenInvoiceDocument.income?.filter(Boolean).map(income => ({
      ...income!,
      currency: income!.currency as Currency,
      vatType: getVatTypeFromGreenInvoiceDocument(income!.vatType),
    })),
    lang: getLanguageFromGreenInvoiceDocument(greenInvoiceDocument.lang),
    payment: greenInvoiceDocument.payment?.filter(Boolean).map(payment => ({
      ...payment!,
      appType: payment?.appType
        ? getPaymentAppTypeFromGreenInvoiceDocument(payment.appType)
        : undefined,
      cardType: payment?.cardType
        ? getCardTypeFromGreenInvoiceDocumentPayment(payment.cardType)
        : undefined,
      currency: payment!.currency as Currency,
      dealType: payment?.dealType
        ? getDealTypeFromGreenInvoiceDocumentPayment(payment.dealType)
        : undefined,
      subType: payment?.subType
        ? getSubTypeFromGreenInvoiceDocumentPayment(payment.subType)
        : undefined,
      type: getTypeFromGreenInvoiceDocumentPayment(payment!.type),
    })),
    type: getTypeFromGreenInvoiceDocument(greenInvoiceDocument.type),
    vatType: getVatTypeFromGreenInvoiceDocument(greenInvoiceDocument.vatType),
  };
}
