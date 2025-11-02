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
import { CountryCode } from '@modules/countries/types';
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
      return CountryCode.AND;
    case 'AE':
      return CountryCode.ARE;
    case 'AF':
      return CountryCode.AFG;
    case 'AG':
      return CountryCode.ATG;
    case 'AI':
      return CountryCode.AIA;
    case 'AL':
      return CountryCode.ALB;
    case 'AM':
      return CountryCode.ARM;
    case 'AO':
      return CountryCode.AGO;
    case 'AQ':
      return CountryCode.ATA;
    case 'AR':
      return CountryCode.ARG;
    case 'AS':
      return CountryCode.ASM;
    case 'AT':
      return CountryCode.AUT;
    case 'AU':
      return CountryCode.AUS;
    case 'AW':
      return CountryCode.ABW;
    case 'AX':
      return CountryCode.ALA;
    case 'AZ':
      return CountryCode.AZE;
    case 'BA':
      return CountryCode.BIH;
    case 'BB':
      return CountryCode.BRB;
    case 'BD':
      return CountryCode.BGD;
    case 'BE':
      return CountryCode.BEL;
    case 'BF':
      return CountryCode.BFA;
    case 'BG':
      return CountryCode.BGR;
    case 'BH':
      return CountryCode.BHR;
    case 'BI':
      return CountryCode.BDI;
    case 'BJ':
      return CountryCode.BEN;
    case 'BL':
      return CountryCode.BLM;
    case 'BM':
      return CountryCode.BMU;
    case 'BN':
      return CountryCode.BRN;
    case 'BO':
      return CountryCode.BOL;
    case 'BQ':
      return CountryCode.BES;
    case 'BR':
      return CountryCode.BRA;
    case 'BS':
      return CountryCode.BHS;
    case 'BT':
      return CountryCode.BTN;
    case 'BV':
      return CountryCode.BVT;
    case 'BW':
      return CountryCode.BWA;
    case 'BY':
      return CountryCode.BLR;
    case 'BZ':
      return CountryCode.BLZ;
    case 'CA':
      return CountryCode.CAN;
    case 'CC':
      return CountryCode.CCK;
    case 'CD':
      return CountryCode.COD;
    case 'CF':
      return CountryCode.CAF;
    case 'CG':
      return CountryCode.COG;
    case 'CH':
      return CountryCode.CHE;
    case 'CI':
      return CountryCode.CIV;
    case 'CK':
      return CountryCode.COK;
    case 'CL':
      return CountryCode.CHL;
    case 'CM':
      return CountryCode.CMR;
    case 'CN':
      return CountryCode.CHN;
    case 'CO':
      return CountryCode.COL;
    case 'CR':
      return CountryCode.CRI;
    case 'CU':
      return CountryCode.CUB;
    case 'CV':
      return CountryCode.CPV;
    case 'CW':
      return CountryCode.CUW;
    case 'CX':
      return CountryCode.CXR;
    case 'CY':
      return CountryCode.CYP;
    case 'CZ':
      return CountryCode.CZE;
    case 'DE':
      return CountryCode.DEU;
    case 'DJ':
      return CountryCode.DJI;
    case 'DK':
      return CountryCode.DNK;
    case 'DM':
      return CountryCode.DMA;
    case 'DO':
      return CountryCode.DOM;
    case 'DZ':
      return CountryCode.DZA;
    case 'EC':
      return CountryCode.ECU;
    case 'EE':
      return CountryCode.EST;
    case 'EG':
      return CountryCode.EGY;
    case 'EH':
      return CountryCode.ESH;
    case 'ER':
      return CountryCode.ERI;
    case 'ES':
      return CountryCode.ESP;
    case 'ET':
      return CountryCode.ETH;
    case 'FI':
      return CountryCode.FIN;
    case 'FJ':
      return CountryCode.FJI;
    case 'FK':
      return CountryCode.FLK;
    case 'FM':
      return CountryCode.FSM;
    case 'FO':
      return CountryCode.FRO;
    case 'FR':
      return CountryCode.FRA;
    case 'GA':
      return CountryCode.GAB;
    case 'GB':
      return CountryCode.GBR;
    case 'GD':
      return CountryCode.GRD;
    case 'GE':
      return CountryCode.GEO;
    case 'GF':
      return CountryCode.GUF;
    case 'GG':
      return CountryCode.GGY;
    case 'GH':
      return CountryCode.GHA;
    case 'GI':
      return CountryCode.GIB;
    case 'GL':
      return CountryCode.GRL;
    case 'GM':
      return CountryCode.GMB;
    case 'GN':
      return CountryCode.GIN;
    case 'GP':
      return CountryCode.GLP;
    case 'GQ':
      return CountryCode.GNQ;
    case 'GR':
      return CountryCode.GRC;
    case 'GS':
      return CountryCode.SGS;
    case 'GT':
      return CountryCode.GTM;
    case 'GU':
      return CountryCode.GUM;
    case 'GW':
      return CountryCode.GNB;
    case 'GY':
      return CountryCode.GUY;
    case 'HK':
      return CountryCode.HKG;
    case 'HM':
      return CountryCode.HMD;
    case 'HN':
      return CountryCode.HND;
    case 'HR':
      return CountryCode.HRV;
    case 'HT':
      return CountryCode.HTI;
    case 'HU':
      return CountryCode.HUN;
    case 'ID':
      return CountryCode.IDN;
    case 'IE':
      return CountryCode.IRL;
    case 'IL':
      return CountryCode.ISR;
    case 'IM':
      return CountryCode.IMN;
    case 'IN':
      return CountryCode.IND;
    case 'IO':
      return CountryCode.IOT;
    case 'IQ':
      return CountryCode.IRQ;
    case 'IR':
      return CountryCode.IRN;
    case 'IS':
      return CountryCode.ISL;
    case 'IT':
      return CountryCode.ITA;
    case 'JE':
      return CountryCode.JEY;
    case 'JM':
      return CountryCode.JAM;
    case 'JO':
      return CountryCode.JOR;
    case 'JP':
      return CountryCode.JPN;
    case 'KE':
      return CountryCode.KEN;
    case 'KG':
      return CountryCode.KGZ;
    case 'KH':
      return CountryCode.KHM;
    case 'KI':
      return CountryCode.KIR;
    case 'KM':
      return CountryCode.COM;
    case 'KN':
      return CountryCode.KNA;
    case 'KP':
      return CountryCode.PRK;
    case 'KR':
      return CountryCode.KOR;
    case 'KW':
      return CountryCode.KWT;
    case 'KY':
      return CountryCode.CYM;
    case 'KZ':
      return CountryCode.KAZ;
    case 'LA':
      return CountryCode.LAO;
    case 'LB':
      return CountryCode.LBN;
    case 'LC':
      return CountryCode.LCA;
    case 'LI':
      return CountryCode.LIE;
    case 'LK':
      return CountryCode.LKA;
    case 'LR':
      return CountryCode.LBR;
    case 'LS':
      return CountryCode.LSO;
    case 'LT':
      return CountryCode.LTU;
    case 'LU':
      return CountryCode.LUX;
    case 'LV':
      return CountryCode.LVA;
    case 'LY':
      return CountryCode.LBY;
    case 'MA':
      return CountryCode.MAR;
    case 'MC':
      return CountryCode.MCO;
    case 'MD':
      return CountryCode.MDA;
    case 'ME':
      return CountryCode.MNE;
    case 'MF':
      return CountryCode.MAF;
    case 'MG':
      return CountryCode.MDG;
    case 'MH':
      return CountryCode.MHL;
    case 'MK':
      return CountryCode.MKD;
    case 'ML':
      return CountryCode.MLI;
    case 'MM':
      return CountryCode.MMR;
    case 'MN':
      return CountryCode.MNG;
    case 'MO':
      return CountryCode.MAC;
    case 'MP':
      return CountryCode.MNP;
    case 'MQ':
      return CountryCode.MTQ;
    case 'MR':
      return CountryCode.MRT;
    case 'MS':
      return CountryCode.MSR;
    case 'MT':
      return CountryCode.MLT;
    case 'MU':
      return CountryCode.MUS;
    case 'MV':
      return CountryCode.MDV;
    case 'MW':
      return CountryCode.MWI;
    case 'MX':
      return CountryCode.MEX;
    case 'MY':
      return CountryCode.MYS;
    case 'MZ':
      return CountryCode.MOZ;
    case 'NA':
      return CountryCode.NAM;
    case 'NC':
      return CountryCode.NCL;
    case 'NE':
      return CountryCode.NER;
    case 'NF':
      return CountryCode.NFK;
    case 'NG':
      return CountryCode.NGA;
    case 'NI':
      return CountryCode.NIC;
    case 'NL':
      return CountryCode.NLD;
    case 'NO':
      return CountryCode.NOR;
    case 'NP':
      return CountryCode.NPL;
    case 'NR':
      return CountryCode.NRU;
    case 'NU':
      return CountryCode.NIU;
    case 'NZ':
      return CountryCode.NZL;
    case 'OM':
      return CountryCode.OMN;
    case 'PA':
      return CountryCode.PAN;
    case 'PE':
      return CountryCode.PER;
    case 'PF':
      return CountryCode.PYF;
    case 'PG':
      return CountryCode.PNG;
    case 'PH':
      return CountryCode.PHL;
    case 'PK':
      return CountryCode.PAK;
    case 'PL':
      return CountryCode.POL;
    case 'PM':
      return CountryCode.SPM;
    case 'PN':
      return CountryCode.PCN;
    case 'PR':
      return CountryCode.PRI;
    case 'PS':
      return CountryCode.PSE;
    case 'PT':
      return CountryCode.PRT;
    case 'PW':
      return CountryCode.PLW;
    case 'PY':
      return CountryCode.PRY;
    case 'QA':
      return CountryCode.QAT;
    case 'RE':
      return CountryCode.REU;
    case 'RO':
      return CountryCode.ROU;
    case 'RS':
      return CountryCode.SRB;
    case 'RU':
      return CountryCode.RUS;
    case 'RW':
      return CountryCode.RWA;
    case 'SA':
      return CountryCode.SAU;
    case 'SB':
      return CountryCode.SLB;
    case 'SC':
      return CountryCode.SYC;
    case 'SD':
      return CountryCode.SDN;
    case 'SE':
      return CountryCode.SWE;
    case 'SG':
      return CountryCode.SGP;
    case 'SH':
      return CountryCode.SHN;
    case 'SI':
      return CountryCode.SVN;
    case 'SJ':
      return CountryCode.SJM;
    case 'SK':
      return CountryCode.SVK;
    case 'SL':
      return CountryCode.SLE;
    case 'SM':
      return CountryCode.SMR;
    case 'SN':
      return CountryCode.SEN;
    case 'SO':
      return CountryCode.SOM;
    case 'SR':
      return CountryCode.SUR;
    case 'SS':
      return CountryCode.SSD;
    case 'ST':
      return CountryCode.STP;
    case 'SV':
      return CountryCode.SLV;
    case 'SX':
      return CountryCode.SXM;
    case 'SY':
      return CountryCode.SYR;
    case 'SZ':
      return CountryCode.SWZ;
    case 'TC':
      return CountryCode.TCA;
    case 'TD':
      return CountryCode.TCD;
    case 'TF':
      return CountryCode.ATF;
    case 'TG':
      return CountryCode.TGO;
    case 'TH':
      return CountryCode.THA;
    case 'TJ':
      return CountryCode.TJK;
    case 'TK':
      return CountryCode.TKL;
    case 'TL':
      return CountryCode.TLS;
    case 'TM':
      return CountryCode.TKM;
    case 'TN':
      return CountryCode.TUN;
    case 'TO':
      return CountryCode.TON;
    case 'TR':
      return CountryCode.TUR;
    case 'TT':
      return CountryCode.TTO;
    case 'TV':
      return CountryCode.TUV;
    case 'TW':
      return CountryCode.TWN;
    case 'TZ':
      return CountryCode.TZA;
    case 'UA':
      return CountryCode.UKR;
    case 'UG':
      return CountryCode.UGA;
    case 'UM':
      return CountryCode.UMI;
    case 'US':
      return CountryCode.USA;
    case 'UY':
      return CountryCode.URY;
    case 'UZ':
      return CountryCode.UZB;
    case 'VA':
      return CountryCode.VAT;
    case 'VC':
      return CountryCode.VCT;
    case 'VE':
      return CountryCode.VEN;
    case 'VG':
      return CountryCode.VGB;
    case 'VI':
      return CountryCode.VIR;
    case 'VN':
      return CountryCode.VNM;
    case 'VU':
      return CountryCode.VUT;
    case 'WF':
      return CountryCode.WLF;
    case 'WS':
      return CountryCode.WSM;
    case 'YE':
      return CountryCode.YEM;
    case 'YT':
      return CountryCode.MYT;
    case 'ZA':
      return CountryCode.ZAF;
    case 'ZM':
      return CountryCode.ZMB;
    case 'ZW':
      return CountryCode.ZWE;
    case 'XK':
      throw new Error(
        `GreenInvoiceCountry 'XK' (Kosovo) is not supported for conversion to CountryCode`,
      );
    default:
      throw new Error(`Unsupported Green Invoice country: ${country}`);
  }
}

export function countryCodeToGreenInvoiceCountry(countryCode: CountryCode): GreenInvoiceCountry {
  switch (countryCode) {
    case CountryCode.AFG:
      return 'AF';
    case CountryCode.ALA:
      return 'AX';
    case CountryCode.ALB:
      return 'AL';
    case CountryCode.DZA:
      return 'DZ';
    case CountryCode.ASM:
      return 'AS';
    case CountryCode.AND:
      return 'AD';
    case CountryCode.AGO:
      return 'AO';
    case CountryCode.AIA:
      return 'AI';
    case CountryCode.ATA:
      return 'AQ';
    case CountryCode.ATG:
      return 'AG';
    case CountryCode.ARG:
      return 'AR';
    case CountryCode.ARM:
      return 'AM';
    case CountryCode.ABW:
      return 'AW';
    case CountryCode.AUS:
      return 'AU';
    case CountryCode.AUT:
      return 'AT';
    case CountryCode.AZE:
      return 'AZ';
    case CountryCode.BHS:
      return 'BS';
    case CountryCode.BHR:
      return 'BH';
    case CountryCode.BGD:
      return 'BD';
    case CountryCode.BRB:
      return 'BB';
    case CountryCode.BLR:
      return 'BY';
    case CountryCode.BEL:
      return 'BE';
    case CountryCode.BLZ:
      return 'BZ';
    case CountryCode.BEN:
      return 'BJ';
    case CountryCode.BMU:
      return 'BM';
    case CountryCode.BTN:
      return 'BT';
    case CountryCode.BOL:
      return 'BO';
    case CountryCode.BES:
      return 'BQ';
    case CountryCode.BIH:
      return 'BA';
    case CountryCode.BWA:
      return 'BW';
    case CountryCode.BVT:
      return 'BV';
    case CountryCode.BRA:
      return 'BR';
    case CountryCode.IOT:
      return 'IO';
    case CountryCode.BRN:
      return 'BN';
    case CountryCode.BGR:
      return 'BG';
    case CountryCode.BFA:
      return 'BF';
    case CountryCode.BDI:
      return 'BI';
    case CountryCode.CPV:
      return 'CV';
    case CountryCode.KHM:
      return 'KH';
    case CountryCode.CMR:
      return 'CM';
    case CountryCode.CAN:
      return 'CA';
    case CountryCode.CYM:
      return 'KY';
    case CountryCode.CAF:
      return 'CF';
    case CountryCode.TCD:
      return 'TD';
    case CountryCode.CHL:
      return 'CL';
    case CountryCode.CHN:
      return 'CN';
    case CountryCode.CXR:
      return 'CX';
    case CountryCode.CCK:
      return 'CC';
    case CountryCode.COL:
      return 'CO';
    case CountryCode.COM:
      return 'KM';
    case CountryCode.COD:
      return 'CD';
    case CountryCode.COG:
      return 'CG';
    case CountryCode.COK:
      return 'CK';
    case CountryCode.CRI:
      return 'CR';
    case CountryCode.HRV:
      return 'HR';
    case CountryCode.CUB:
      return 'CU';
    case CountryCode.CUW:
      return 'CW';
    case CountryCode.CYP:
      return 'CY';
    case CountryCode.CZE:
      return 'CZ';
    case CountryCode.CIV:
      return 'CI';
    case CountryCode.DNK:
      return 'DK';
    case CountryCode.DJI:
      return 'DJ';
    case CountryCode.DMA:
      return 'DM';
    case CountryCode.DOM:
      return 'DO';
    case CountryCode.ECU:
      return 'EC';
    case CountryCode.EGY:
      return 'EG';
    case CountryCode.SLV:
      return 'SV';
    case CountryCode.GNQ:
      return 'GQ';
    case CountryCode.ERI:
      return 'ER';
    case CountryCode.EST:
      return 'EE';
    case CountryCode.SWZ:
      return 'SZ';
    case CountryCode.ETH:
      return 'ET';
    case CountryCode.FLK:
      return 'FK';
    case CountryCode.FRO:
      return 'FO';
    case CountryCode.FJI:
      return 'FJ';
    case CountryCode.FIN:
      return 'FI';
    case CountryCode.FRA:
      return 'FR';
    case CountryCode.GUF:
      return 'GF';
    case CountryCode.PYF:
      return 'PF';
    case CountryCode.ATF:
      return 'TF';
    case CountryCode.GAB:
      return 'GA';
    case CountryCode.GMB:
      return 'GM';
    case CountryCode.GEO:
      return 'GE';
    case CountryCode.DEU:
      return 'DE';
    case CountryCode.GHA:
      return 'GH';
    case CountryCode.GIB:
      return 'GI';
    case CountryCode.GRC:
      return 'GR';
    case CountryCode.GRL:
      return 'GL';
    case CountryCode.GRD:
      return 'GD';
    case CountryCode.GLP:
      return 'GP';
    case CountryCode.GUM:
      return 'GU';
    case CountryCode.GTM:
      return 'GT';
    case CountryCode.GGY:
      return 'GG';
    case CountryCode.GIN:
      return 'GN';
    case CountryCode.GNB:
      return 'GW';
    case CountryCode.GUY:
      return 'GY';
    case CountryCode.HTI:
      return 'HT';
    case CountryCode.HMD:
      return 'HM';
    case CountryCode.VAT:
      return 'VA';
    case CountryCode.HND:
      return 'HN';
    case CountryCode.HKG:
      return 'HK';
    case CountryCode.HUN:
      return 'HU';
    case CountryCode.ISL:
      return 'IS';
    case CountryCode.IND:
      return 'IN';
    case CountryCode.IDN:
      return 'ID';
    case CountryCode.IRN:
      return 'IR';
    case CountryCode.IRQ:
      return 'IQ';
    case CountryCode.IRL:
      return 'IE';
    case CountryCode.IMN:
      return 'IM';
    case CountryCode.ISR:
      return 'IL';
    case CountryCode.ITA:
      return 'IT';
    case CountryCode.JAM:
      return 'JM';
    case CountryCode.JPN:
      return 'JP';
    case CountryCode.JEY:
      return 'JE';
    case CountryCode.JOR:
      return 'JO';
    case CountryCode.KAZ:
      return 'KZ';
    case CountryCode.KEN:
      return 'KE';
    case CountryCode.KIR:
      return 'KI';
    case CountryCode.PRK:
      return 'KP';
    case CountryCode.KOR:
      return 'KR';
    case CountryCode.KWT:
      return 'KW';
    case CountryCode.KGZ:
      return 'KG';
    case CountryCode.LAO:
      return 'LA';
    case CountryCode.LVA:
      return 'LV';
    case CountryCode.LBN:
      return 'LB';
    case CountryCode.LSO:
      return 'LS';
    case CountryCode.LBR:
      return 'LR';
    case CountryCode.LBY:
      return 'LY';
    case CountryCode.LIE:
      return 'LI';
    case CountryCode.LTU:
      return 'LT';
    case CountryCode.LUX:
      return 'LU';
    case CountryCode.MAC:
      return 'MO';
    case CountryCode.MDG:
      return 'MG';
    case CountryCode.MWI:
      return 'MW';
    case CountryCode.MYS:
      return 'MY';
    case CountryCode.MDV:
      return 'MV';
    case CountryCode.MLI:
      return 'ML';
    case CountryCode.MLT:
      return 'MT';
    case CountryCode.MHL:
      return 'MH';
    case CountryCode.MTQ:
      return 'MQ';
    case CountryCode.MRT:
      return 'MR';
    case CountryCode.MUS:
      return 'MU';
    case CountryCode.MYT:
      return 'YT';
    case CountryCode.MEX:
      return 'MX';
    case CountryCode.FSM:
      return 'FM';
    case CountryCode.MDA:
      return 'MD';
    case CountryCode.MCO:
      return 'MC';
    case CountryCode.MNG:
      return 'MN';
    case CountryCode.MNE:
      return 'ME';
    case CountryCode.MSR:
      return 'MS';
    case CountryCode.MAR:
      return 'MA';
    case CountryCode.MOZ:
      return 'MZ';
    case CountryCode.MMR:
      return 'MM';
    case CountryCode.NAM:
      return 'NA';
    case CountryCode.NRU:
      return 'NR';
    case CountryCode.NPL:
      return 'NP';
    case CountryCode.NLD:
      return 'NL';
    case CountryCode.NCL:
      return 'NC';
    case CountryCode.NZL:
      return 'NZ';
    case CountryCode.NIC:
      return 'NI';
    case CountryCode.NER:
      return 'NE';
    case CountryCode.NGA:
      return 'NG';
    case CountryCode.NIU:
      return 'NU';
    case CountryCode.NFK:
      return 'NF';
    case CountryCode.MNP:
      return 'MP';
    case CountryCode.NOR:
      return 'NO';
    case CountryCode.OMN:
      return 'OM';
    case CountryCode.PAK:
      return 'PK';
    case CountryCode.PLW:
      return 'PW';
    case CountryCode.PSE:
      return 'PS';
    case CountryCode.PAN:
      return 'PA';
    case CountryCode.PNG:
      return 'PG';
    case CountryCode.PRY:
      return 'PY';
    case CountryCode.PER:
      return 'PE';
    case CountryCode.PHL:
      return 'PH';
    case CountryCode.PCN:
      return 'PN';
    case CountryCode.POL:
      return 'PL';
    case CountryCode.PRT:
      return 'PT';
    case CountryCode.PRI:
      return 'PR';
    case CountryCode.QAT:
      return 'QA';
    case CountryCode.MKD:
      return 'MK';
    case CountryCode.ROU:
      return 'RO';
    case CountryCode.RUS:
      return 'RU';
    case CountryCode.RWA:
      return 'RW';
    case CountryCode.REU:
      return 'RE';
    case CountryCode.BLM:
      return 'BL';
    case CountryCode.SHN:
      return 'SH';
    case CountryCode.KNA:
      return 'KN';
    case CountryCode.LCA:
      return 'LC';
    case CountryCode.MAF:
      return 'MF';
    case CountryCode.SPM:
      return 'PM';
    case CountryCode.VCT:
      return 'VC';
    case CountryCode.WSM:
      return 'WS';
    case CountryCode.SMR:
      return 'SM';
    case CountryCode.STP:
      return 'ST';
    case CountryCode.SAU:
      return 'SA';
    case CountryCode.SEN:
      return 'SN';
    case CountryCode.SRB:
      return 'RS';
    case CountryCode.SYC:
      return 'SC';
    case CountryCode.SLE:
      return 'SL';
    case CountryCode.SGP:
      return 'SG';
    case CountryCode.SXM:
      return 'SX';
    case CountryCode.SVK:
      return 'SK';
    case CountryCode.SVN:
      return 'SI';
    case CountryCode.SLB:
      return 'SB';
    case CountryCode.SOM:
      return 'SO';
    case CountryCode.ZAF:
      return 'ZA';
    case CountryCode.SGS:
      return 'GS';
    case CountryCode.SSD:
      return 'SS';
    case CountryCode.ESP:
      return 'ES';
    case CountryCode.LKA:
      return 'LK';
    case CountryCode.SDN:
      return 'SD';
    case CountryCode.SUR:
      return 'SR';
    case CountryCode.SJM:
      return 'SJ';
    case CountryCode.SWE:
      return 'SE';
    case CountryCode.CHE:
      return 'CH';
    case CountryCode.SYR:
      return 'SY';
    case CountryCode.TWN:
      return 'TW';
    case CountryCode.TJK:
      return 'TJ';
    case CountryCode.TZA:
      return 'TZ';
    case CountryCode.THA:
      return 'TH';
    case CountryCode.TLS:
      return 'TL';
    case CountryCode.TGO:
      return 'TG';
    case CountryCode.TKL:
      return 'TK';
    case CountryCode.TON:
      return 'TO';
    case CountryCode.TTO:
      return 'TT';
    case CountryCode.TUN:
      return 'TN';
    case CountryCode.TUR:
      return 'TR';
    case CountryCode.TKM:
      return 'TM';
    case CountryCode.TCA:
      return 'TC';
    case CountryCode.TUV:
      return 'TV';
    case CountryCode.UGA:
      return 'UG';
    case CountryCode.UKR:
      return 'UA';
    case CountryCode.ARE:
      return 'AE';
    case CountryCode.GBR:
      return 'GB';
    case CountryCode.UMI:
      return 'UM';
    case CountryCode.USA:
      return 'US';
    case CountryCode.URY:
      return 'UY';
    case CountryCode.UZB:
      return 'UZ';
    case CountryCode.VUT:
      return 'VU';
    case CountryCode.VEN:
      return 'VE';
    case CountryCode.VNM:
      return 'VN';
    case CountryCode.VGB:
      return 'VG';
    case CountryCode.VIR:
      return 'VI';
    case CountryCode.WLF:
      return 'WF';
    case CountryCode.ESH:
      return 'EH';
    case CountryCode.YEM:
      return 'YE';
    case CountryCode.ZMB:
      return 'ZM';
    case CountryCode.ZWE:
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
