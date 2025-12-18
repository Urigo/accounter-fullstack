import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type {
  _DOLLAR_defs_addDocumentRequest_Input,
  _DOLLAR_defs_Country,
  _DOLLAR_defs_Currency,
  _DOLLAR_defs_Document,
  _DOLLAR_defs_DocumentInputNew_Input,
  _DOLLAR_defs_DocumentLang,
  _DOLLAR_defs_DocumentLinkedDocument,
  _DOLLAR_defs_DocumentType,
  _DOLLAR_defs_ExpenseDocumentType,
  _DOLLAR_defs_VatType,
  query_getDocument_payment_items_cardType,
  query_getDocument_payment_items_type,
  queryInput_previewDocument_input_discount_type,
  queryInput_previewDocument_input_linkType,
} from '@accounter/green-invoice-graphql';
import type {
  DocumentDiscountType,
  DocumentIssueInput,
  DocumentLanguage,
  DocumentLinkType,
  DocumentPaymentRecordCardType,
  DocumentVatType,
  PaymentType,
  ResolversTypes,
} from '../../../__generated__/types.js';
import { CountryCode, Currency, DocumentType } from '../../../shared/enums.js';
import { formatCurrency, hashStringToInt } from '../../../shared/helpers/index.js';
import { CloudinaryProvider } from '../../app-providers/cloudinary.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../../documents/providers/issued-documents.provider.js';
import type { document_status, IInsertDocumentsParams } from '../../documents/types.js';
import { validateClientIntegrations } from '../../financial-entities/helpers/clients.helper.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';

export function normalizeGreenInvoiceDocumentType(
  rawType?: _DOLLAR_defs_DocumentType | _DOLLAR_defs_ExpenseDocumentType | number | null,
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

export function getGreenInvoiceDocumentType(documentType: DocumentType): _DOLLAR_defs_DocumentType {
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
  documentType: _DOLLAR_defs_DocumentType,
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

export function getDocumentNameFromGreenInvoiceType(
  documentType: _DOLLAR_defs_DocumentType,
): string {
  switch (documentType) {
    case '_305':
      return 'Tax Invoice';
    case '_300':
      return 'Proforma Invoice';
    case '_320':
      return 'Invoice / Receipt';
    case '_330':
      return 'Credit Note';
    case '_400':
      return 'Receipt';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentLanguage(
  language: DocumentLanguage,
): _DOLLAR_defs_DocumentLang {
  switch (language) {
    case 'HEBREW':
      return 'he';
    case 'ENGLISH':
      return 'en';
    default:
      throw new Error(`Unsupported document language: ${language}`);
  }
}

export function getLanguageFromGreenInvoiceDocument(
  lang: _DOLLAR_defs_DocumentLang,
): DocumentLanguage {
  switch (lang) {
    case 'he':
      return 'HEBREW';
    case 'en':
      return 'ENGLISH';
    default:
      throw new Error(`Unsupported document language: ${lang}`);
  }
}

export function getGreenInvoiceDocumentVatType(vatType: DocumentVatType): _DOLLAR_defs_VatType {
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

export function getVatTypeFromGreenInvoiceDocument(vatType: _DOLLAR_defs_VatType): DocumentVatType {
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
  discountType: DocumentDiscountType,
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
  type: PaymentType,
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
): PaymentType {
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

// export function getGreenInvoiceDocumentPaymentSubType(
//   subType: GreenInvoicePaymentSubType,
// ): query_getDocument_payment_items_subType {
//   switch (subType) {
//     case 'BITCOIN':
//       return '_1';
//     case 'BUYME_VOUCHER':
//       return '_7';
//     case 'ETHEREUM':
//       return '_6';
//     case 'GIFT_CARD':
//       return '_4';
//     case 'MONEY_EQUAL':
//       return '_2';
//     case 'NII_EMPLOYEE_DEDUCTION':
//       return '_5';
//     case 'PAYONEER':
//       return '_8';
//     case 'V_CHECK':
//       return '_3';
//     default:
//       throw new Error(`Unsupported payment sub-type: ${subType}`);
//   }
// }

// export function getSubTypeFromGreenInvoiceDocumentPayment(
//   subType: query_getDocument_payment_items_subType,
// ): GreenInvoicePaymentSubType {
//   switch (subType) {
//     case '_1':
//       return 'BITCOIN';
//     case '_7':
//       return 'BUYME_VOUCHER';
//     case '_6':
//       return 'ETHEREUM';
//     case '_4':
//       return 'GIFT_CARD';
//     case '_2':
//       return 'MONEY_EQUAL';
//     case '_5':
//       return 'NII_EMPLOYEE_DEDUCTION';
//     case '_8':
//       return 'PAYONEER';
//     case '_3':
//       return 'V_CHECK';
//     default:
//       throw new Error(`Unsupported payment sub-type: ${subType}`);
//   }
// }

// export function getGreenInvoiceDocumentPaymentAppType(
//   appType: GreenInvoicePaymentAppType,
// ): query_getDocument_payment_items_appType {
//   switch (appType) {
//     case 'APPLE_PAY':
//       return '_6';
//     case 'BIT':
//       return '_1';
//     case 'CULO':
//       return '_4';
//     case 'GOOGLE_PAY':
//       return '_5';
//     case 'PAYBOX':
//       return '_3';
//     case 'PAY_BY_PEPPER':
//       return '_2';
//     default:
//       throw new Error(`Unsupported payment app type: ${appType}`);
//   }
// }

// export function getPaymentAppTypeFromGreenInvoiceDocument(
//   appType: query_getDocument_payment_items_appType,
// ): GreenInvoicePaymentAppType {
//   switch (appType) {
//     case '_6':
//       return 'APPLE_PAY';
//     case '_1':
//       return 'BIT';
//     case '_4':
//       return 'CULO';
//     case '_5':
//       return 'GOOGLE_PAY';
//     case '_3':
//       return 'PAYBOX';
//     case '_2':
//       return 'PAY_BY_PEPPER';
//     default:
//       throw new Error(`Unsupported payment app type: ${appType}`);
//   }
// }

export function getGreenInvoiceDocumentPaymentCardType(
  cardType: DocumentPaymentRecordCardType,
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
): DocumentPaymentRecordCardType {
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

// export function getGreenInvoiceDocumentPaymentDealType(
//   dealType: GreenInvoicePaymentDealType,
// ): query_getDocument_payment_items_dealType {
//   switch (dealType) {
//     case 'CREDIT':
//       return '_3';
//     case 'DEFERRED':
//       return '_4';
//     case 'OTHER':
//       return '_5';
//     case 'PAYMENTS':
//       return '_2';
//     case 'RECURRING':
//       return '_6';
//     case 'STANDARD':
//       return '_1';
//     default:
//       throw new Error(`Unsupported payment deal type: ${dealType}`);
//   }
// }

// export function getDealTypeFromGreenInvoiceDocumentPayment(
//   dealType: query_getDocument_payment_items_dealType,
// ): GreenInvoicePaymentDealType {
//   switch (dealType) {
//     case '_3':
//       return 'CREDIT';
//     case '_4':
//       return 'DEFERRED';
//     case '_5':
//       return 'OTHER';
//     case '_2':
//       return 'PAYMENTS';
//     case '_6':
//       return 'RECURRING';
//     case '_1':
//       return 'STANDARD';
//     default:
//       throw new Error(`Unsupported payment deal type: ${dealType}`);
//   }
// }

export function getGreenInvoiceDocumentLinkType(
  linkType: DocumentLinkType,
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

export function convertCurrencyToGreenInvoice(currency: Currency): _DOLLAR_defs_Currency {
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

export function greenInvoiceCountryToCountryCode(country: _DOLLAR_defs_Country): CountryCode {
  const greenInvoiceToCountryCodeMap: Partial<Record<_DOLLAR_defs_Country, CountryCode>> = {
    AD: CountryCode.Andorra,
    AE: CountryCode['United Arab Emirates (the)'],
    AF: CountryCode.Afghanistan,
    AG: CountryCode['Antigua and Barbuda'],
    AI: CountryCode.Anguilla,
    AL: CountryCode.Albania,
    AM: CountryCode.Armenia,
    AO: CountryCode.Angola,
    AQ: CountryCode.Antarctica,
    AR: CountryCode.Argentina,
    AS: CountryCode['American Samoa'],
    AT: CountryCode.Austria,
    AU: CountryCode.Australia,
    AW: CountryCode.Aruba,
    AX: CountryCode['Åland Islands'],
    AZ: CountryCode.Azerbaijan,
    BA: CountryCode['Bosnia and Herzegovina'],
    BB: CountryCode.Barbados,
    BD: CountryCode.Bangladesh,
    BE: CountryCode.Belgium,
    BF: CountryCode['Burkina Faso'],
    BG: CountryCode.Bulgaria,
    BH: CountryCode.Bahrain,
    BI: CountryCode.Burundi,
    BJ: CountryCode.Benin,
    BL: CountryCode['Saint Barthélemy'],
    BM: CountryCode.Bermuda,
    BN: CountryCode['Brunei Darussalam'],
    BO: CountryCode['Bolivia (Plurinational State of)'],
    BQ: CountryCode['Bonaire, Sint Eustatius and Saba'],
    BR: CountryCode.Brazil,
    BS: CountryCode['Bahamas (the)'],
    BT: CountryCode.Bhutan,
    BV: CountryCode['Bouvet Island'],
    BW: CountryCode.Botswana,
    BY: CountryCode.Belarus,
    BZ: CountryCode.Belize,
    CA: CountryCode.Canada,
    CC: CountryCode['Cocos (Keeling) Islands (the)'],
    CD: CountryCode['Congo (the Democratic Republic of the)'],
    CF: CountryCode['Central African Republic (the)'],
    CG: CountryCode['Congo (the)'],
    CH: CountryCode.Switzerland,
    CI: CountryCode["Côte d'Ivoire"],
    CK: CountryCode['Cook Islands (the)'],
    CL: CountryCode.Chile,
    CM: CountryCode.Cameroon,
    CN: CountryCode.China,
    CO: CountryCode.Colombia,
    CR: CountryCode['Costa Rica'],
    CU: CountryCode.Cuba,
    CV: CountryCode['Cabo Verde'],
    CW: CountryCode.Curaçao,
    CX: CountryCode['Christmas Island'],
    CY: CountryCode.Cyprus,
    CZ: CountryCode.Czechia,
    DE: CountryCode.Germany,
    DJ: CountryCode.Djibouti,
    DK: CountryCode.Denmark,
    DM: CountryCode.Dominica,
    DO: CountryCode['Dominican Republic (the)'],
    DZ: CountryCode.Algeria,
    EC: CountryCode.Ecuador,
    EE: CountryCode.Estonia,
    EG: CountryCode.Egypt,
    EH: CountryCode['Western Sahara'],
    ER: CountryCode.Eritrea,
    ES: CountryCode.Spain,
    ET: CountryCode.Ethiopia,
    FI: CountryCode.Finland,
    FJ: CountryCode.Fiji,
    FK: CountryCode['Falkland Islands (the) [Malvinas]'],
    FM: CountryCode['Micronesia (Federated States of)'],
    FO: CountryCode['Faroe Islands (the)'],
    FR: CountryCode.France,
    GA: CountryCode.Gabon,
    GB: CountryCode['United Kingdom of Great Britain and Northern Ireland (the)'],
    GD: CountryCode.Grenada,
    GE: CountryCode.Georgia,
    GF: CountryCode['French Guiana'],
    GG: CountryCode.Guernsey,
    GH: CountryCode.Ghana,
    GI: CountryCode.Gibraltar,
    GL: CountryCode.Greenland,
    GM: CountryCode['Gambia (the)'],
    GN: CountryCode.Guinea,
    GP: CountryCode.Guadeloupe,
    GQ: CountryCode['Equatorial Guinea'],
    GR: CountryCode.Greece,
    GS: CountryCode['South Georgia and the South Sandwich Islands'],
    GT: CountryCode.Guatemala,
    GU: CountryCode.Guam,
    GW: CountryCode['Guinea-Bissau'],
    GY: CountryCode.Guyana,
    HK: CountryCode['Hong Kong'],
    HM: CountryCode['Heard Island and McDonald Islands'],
    HN: CountryCode.Honduras,
    HR: CountryCode.Croatia,
    HT: CountryCode.Haiti,
    HU: CountryCode.Hungary,
    ID: CountryCode.Indonesia,
    IE: CountryCode.Ireland,
    IL: CountryCode.Israel,
    IM: CountryCode['Isle of Man'],
    IN: CountryCode.India,
    IO: CountryCode['British Indian Ocean Territory (the)'],
    IQ: CountryCode.Iraq,
    IR: CountryCode['Iran (Islamic Republic of)'],
    IS: CountryCode.Iceland,
    IT: CountryCode.Italy,
    JE: CountryCode.Jersey,
    JM: CountryCode.Jamaica,
    JO: CountryCode.Jordan,
    JP: CountryCode.Japan,
    KE: CountryCode.Kenya,
    KG: CountryCode.Kyrgyzstan,
    KH: CountryCode.Cambodia,
    KI: CountryCode.Kiribati,
    KM: CountryCode['Comoros (the)'],
    KN: CountryCode['Saint Kitts and Nevis'],
    KP: CountryCode["Korea (the Democratic People's Republic of)"],
    KR: CountryCode['Korea (the Republic of)'],
    KW: CountryCode.Kuwait,
    KY: CountryCode['Cayman Islands (the)'],
    KZ: CountryCode.Kazakhstan,
    LA: CountryCode["Lao People's Democratic Republic (the)"],
    LB: CountryCode.Lebanon,
    LC: CountryCode['Saint Lucia'],
    LI: CountryCode.Liechtenstein,
    LK: CountryCode['Sri Lanka'],
    LR: CountryCode.Liberia,
    LS: CountryCode.Lesotho,
    LT: CountryCode.Lithuania,
    LU: CountryCode.Luxembourg,
    LV: CountryCode.Latvia,
    LY: CountryCode.Libya,
    MA: CountryCode.Morocco,
    MC: CountryCode.Monaco,
    MD: CountryCode['Moldova (the Republic of)'],
    ME: CountryCode.Montenegro,
    MF: CountryCode['Saint Martin (French part)'],
    MG: CountryCode.Madagascar,
    MH: CountryCode['Marshall Islands (the)'],
    MK: CountryCode['Republic of North Macedonia'],
    ML: CountryCode.Mali,
    MM: CountryCode.Myanmar,
    MN: CountryCode.Mongolia,
    MO: CountryCode.Macao,
    MP: CountryCode['Northern Mariana Islands (the)'],
    MQ: CountryCode.Martinique,
    MR: CountryCode.Mauritania,
    MS: CountryCode.Montserrat,
    MT: CountryCode.Malta,
    MU: CountryCode.Mauritius,
    MV: CountryCode.Maldives,
    MW: CountryCode.Malawi,
    MX: CountryCode.Mexico,
    MY: CountryCode.Malaysia,
    MZ: CountryCode.Mozambique,
    NA: CountryCode.Namibia,
    NC: CountryCode['New Caledonia'],
    NE: CountryCode['Niger (the)'],
    NF: CountryCode['Norfolk Island'],
    NG: CountryCode.Nigeria,
    NI: CountryCode.Nicaragua,
    NL: CountryCode['Netherlands (the)'],
    NO: CountryCode.Norway,
    NP: CountryCode.Nepal,
    NR: CountryCode.Nauru,
    NU: CountryCode.Niue,
    NZ: CountryCode['New Zealand'],
    OM: CountryCode.Oman,
    PA: CountryCode.Panama,
    PE: CountryCode.Peru,
    PF: CountryCode['French Polynesia'],
    PG: CountryCode['Papua New Guinea'],
    PH: CountryCode['Philippines (the)'],
    PK: CountryCode.Pakistan,
    PL: CountryCode.Poland,
    PM: CountryCode['Saint Pierre and Miquelon'],
    PN: CountryCode.Pitcairn,
    PR: CountryCode['Puerto Rico'],
    PS: CountryCode['Palestine, State of'],
    PT: CountryCode.Portugal,
    PW: CountryCode.Palau,
    PY: CountryCode.Paraguay,
    QA: CountryCode.Qatar,
    RE: CountryCode.Réunion,
    RO: CountryCode.Romania,
    RS: CountryCode.Serbia,
    RU: CountryCode['Russian Federation (the)'],
    RW: CountryCode.Rwanda,
    SA: CountryCode['Saudi Arabia'],
    SB: CountryCode['Solomon Islands'],
    SC: CountryCode.Seychelles,
    SD: CountryCode['Sudan (the)'],
    SE: CountryCode.Sweden,
    SG: CountryCode.Singapore,
    SH: CountryCode['Saint Helena, Ascension and Tristan da Cunha'],
    SI: CountryCode.Slovenia,
    SJ: CountryCode['Svalbard and Jan Mayen'],
    SK: CountryCode.Slovakia,
    SL: CountryCode['Sierra Leone'],
    SM: CountryCode['San Marino'],
    SN: CountryCode.Senegal,
    SO: CountryCode.Somalia,
    SR: CountryCode.Suriname,
    SS: CountryCode['South Sudan'],
    ST: CountryCode['Sao Tome and Principe'],
    SV: CountryCode['El Salvador'],
    SX: CountryCode['Sint Maarten (Dutch part)'],
    SY: CountryCode['Syrian Arab Republic'],
    SZ: CountryCode.Eswatini,
    TC: CountryCode['Turks and Caicos Islands (the)'],
    TD: CountryCode.Chad,
    TF: CountryCode['French Southern Territories (the)'],
    TG: CountryCode.Togo,
    TH: CountryCode.Thailand,
    TJ: CountryCode.Tajikistan,
    TK: CountryCode.Tokelau,
    TL: CountryCode['Timor-Leste'],
    TM: CountryCode.Turkmenistan,
    TN: CountryCode.Tunisia,
    TO: CountryCode.Tonga,
    TR: CountryCode.Turkey,
    TT: CountryCode['Trinidad and Tobago'],
    TV: CountryCode.Tuvalu,
    TW: CountryCode['Taiwan (Province of China)'],
    TZ: CountryCode['Tanzania, United Republic of'],
    UA: CountryCode.Ukraine,
    UG: CountryCode.Uganda,
    UM: CountryCode['United States Minor Outlying Islands (the)'],
    US: CountryCode['United States of America (the)'],
    UY: CountryCode.Uruguay,
    UZ: CountryCode.Uzbekistan,
    VA: CountryCode['Holy See (the)'],
    VC: CountryCode['Saint Vincent and the Grenadines'],
    VE: CountryCode['Venezuela (Bolivarian Republic of)'],
    VG: CountryCode['Virgin Islands (British)'],
    VI: CountryCode['Virgin Islands (U.S.)'],
    VN: CountryCode['Viet Nam'],
    VU: CountryCode.Vanuatu,
    WF: CountryCode['Wallis and Futuna'],
    WS: CountryCode.Samoa,
    YE: CountryCode.Yemen,
    YT: CountryCode.Mayotte,
    ZA: CountryCode['South Africa'],
    ZM: CountryCode.Zambia,
    ZW: CountryCode.Zimbabwe,
  };

  if (country === 'XK') {
    // TODO: remove this once green invoice adds Kosovo to their list
    return CountryCode.Serbia;
  }
  const code = greenInvoiceToCountryCodeMap[country];
  if (code) {
    return code;
  }
  throw new Error(`Unsupported Green Invoice country: ${country}`);
}

export function countryCodeToGreenInvoiceCountry(countryCode: CountryCode): _DOLLAR_defs_Country {
  const countryCodeToGreenInvoiceMap: Partial<Record<CountryCode, _DOLLAR_defs_Country>> = {
    [CountryCode.Afghanistan]: 'AF',
    [CountryCode['Åland Islands']]: 'AX',
    [CountryCode.Albania]: 'AL',
    [CountryCode.Algeria]: 'DZ',
    [CountryCode['American Samoa']]: 'AS',
    [CountryCode.Andorra]: 'AD',
    [CountryCode.Angola]: 'AO',
    [CountryCode.Anguilla]: 'AI',
    [CountryCode.Antarctica]: 'AQ',
    [CountryCode['Antigua and Barbuda']]: 'AG',
    [CountryCode.Argentina]: 'AR',
    [CountryCode.Armenia]: 'AM',
    [CountryCode.Aruba]: 'AW',
    [CountryCode.Australia]: 'AU',
    [CountryCode.Austria]: 'AT',
    [CountryCode.Azerbaijan]: 'AZ',
    [CountryCode['Bahamas (the)']]: 'BS',
    [CountryCode.Bahrain]: 'BH',
    [CountryCode.Bangladesh]: 'BD',
    [CountryCode.Barbados]: 'BB',
    [CountryCode.Belarus]: 'BY',
    [CountryCode.Belgium]: 'BE',
    [CountryCode.Belize]: 'BZ',
    [CountryCode.Benin]: 'BJ',
    [CountryCode.Bermuda]: 'BM',
    [CountryCode.Bhutan]: 'BT',
    [CountryCode['Bolivia (Plurinational State of)']]: 'BO',
    [CountryCode['Bonaire, Sint Eustatius and Saba']]: 'BQ',
    [CountryCode['Bosnia and Herzegovina']]: 'BA',
    [CountryCode.Botswana]: 'BW',
    [CountryCode['Bouvet Island']]: 'BV',
    [CountryCode.Brazil]: 'BR',
    [CountryCode['British Indian Ocean Territory (the)']]: 'IO',
    [CountryCode['Brunei Darussalam']]: 'BN',
    [CountryCode.Bulgaria]: 'BG',
    [CountryCode['Burkina Faso']]: 'BF',
    [CountryCode.Burundi]: 'BI',
    [CountryCode['Cabo Verde']]: 'CV',
    [CountryCode.Cambodia]: 'KH',
    [CountryCode.Cameroon]: 'CM',
    [CountryCode.Canada]: 'CA',
    [CountryCode['Cayman Islands (the)']]: 'KY',
    [CountryCode['Central African Republic (the)']]: 'CF',
    [CountryCode.Chad]: 'TD',
    [CountryCode.Chile]: 'CL',
    [CountryCode.China]: 'CN',
    [CountryCode['Christmas Island']]: 'CX',
    [CountryCode['Cocos (Keeling) Islands (the)']]: 'CC',
    [CountryCode.Colombia]: 'CO',
    [CountryCode['Comoros (the)']]: 'KM',
    [CountryCode['Congo (the Democratic Republic of the)']]: 'CD',
    [CountryCode['Congo (the)']]: 'CG',
    [CountryCode['Cook Islands (the)']]: 'CK',
    [CountryCode['Costa Rica']]: 'CR',
    [CountryCode.Croatia]: 'HR',
    [CountryCode.Cuba]: 'CU',
    [CountryCode.Curaçao]: 'CW',
    [CountryCode.Cyprus]: 'CY',
    [CountryCode.Czechia]: 'CZ',
    [CountryCode["Côte d'Ivoire"]]: 'CI',
    [CountryCode.Denmark]: 'DK',
    [CountryCode.Djibouti]: 'DJ',
    [CountryCode.Dominica]: 'DM',
    [CountryCode['Dominican Republic (the)']]: 'DO',
    [CountryCode.Ecuador]: 'EC',
    [CountryCode.Egypt]: 'EG',
    [CountryCode['El Salvador']]: 'SV',
    [CountryCode['Equatorial Guinea']]: 'GQ',
    [CountryCode.Eritrea]: 'ER',
    [CountryCode.Estonia]: 'EE',
    [CountryCode.Eswatini]: 'SZ',
    [CountryCode.Ethiopia]: 'ET',
    [CountryCode['Falkland Islands (the) [Malvinas]']]: 'FK',
    [CountryCode['Faroe Islands (the)']]: 'FO',
    [CountryCode.Fiji]: 'FJ',
    [CountryCode.Finland]: 'FI',
    [CountryCode.France]: 'FR',
    [CountryCode['French Guiana']]: 'GF',
    [CountryCode['French Polynesia']]: 'PF',
    [CountryCode['French Southern Territories (the)']]: 'TF',
    [CountryCode.Gabon]: 'GA',
    [CountryCode['Gambia (the)']]: 'GM',
    [CountryCode.Georgia]: 'GE',
    [CountryCode.Germany]: 'DE',
    [CountryCode.Ghana]: 'GH',
    [CountryCode.Gibraltar]: 'GI',
    [CountryCode.Greece]: 'GR',
    [CountryCode.Greenland]: 'GL',
    [CountryCode.Grenada]: 'GD',
    [CountryCode.Guadeloupe]: 'GP',
    [CountryCode.Guam]: 'GU',
    [CountryCode.Guatemala]: 'GT',
    [CountryCode.Guernsey]: 'GG',
    [CountryCode.Guinea]: 'GN',
    [CountryCode['Guinea-Bissau']]: 'GW',
    [CountryCode.Guyana]: 'GY',
    [CountryCode.Haiti]: 'HT',
    [CountryCode['Heard Island and McDonald Islands']]: 'HM',
    [CountryCode['Holy See (the)']]: 'VA',
    [CountryCode.Honduras]: 'HN',
    [CountryCode['Hong Kong']]: 'HK',
    [CountryCode.Hungary]: 'HU',
    [CountryCode.Iceland]: 'IS',
    [CountryCode.India]: 'IN',
    [CountryCode.Indonesia]: 'ID',
    [CountryCode['Iran (Islamic Republic of)']]: 'IR',
    [CountryCode.Iraq]: 'IQ',
    [CountryCode.Ireland]: 'IE',
    [CountryCode['Isle of Man']]: 'IM',
    [CountryCode.Israel]: 'IL',
    [CountryCode.Italy]: 'IT',
    [CountryCode.Jamaica]: 'JM',
    [CountryCode.Japan]: 'JP',
    [CountryCode.Jersey]: 'JE',
    [CountryCode.Jordan]: 'JO',
    [CountryCode.Kazakhstan]: 'KZ',
    [CountryCode.Kenya]: 'KE',
    [CountryCode.Kiribati]: 'KI',
    [CountryCode["Korea (the Democratic People's Republic of)"]]: 'KP',
    [CountryCode['Korea (the Republic of)']]: 'KR',
    [CountryCode.Kuwait]: 'KW',
    [CountryCode.Kyrgyzstan]: 'KG',
    [CountryCode["Lao People's Democratic Republic (the)"]]: 'LA',
    [CountryCode.Latvia]: 'LV',
    [CountryCode.Lebanon]: 'LB',
    [CountryCode.Lesotho]: 'LS',
    [CountryCode.Liberia]: 'LR',
    [CountryCode.Libya]: 'LY',
    [CountryCode.Liechtenstein]: 'LI',
    [CountryCode.Lithuania]: 'LT',
    [CountryCode.Luxembourg]: 'LU',
    [CountryCode.Macao]: 'MO',
    [CountryCode.Madagascar]: 'MG',
    [CountryCode.Malawi]: 'MW',
    [CountryCode.Malaysia]: 'MY',
    [CountryCode.Maldives]: 'MV',
    [CountryCode.Mali]: 'ML',
    [CountryCode.Malta]: 'MT',
    [CountryCode['Marshall Islands (the)']]: 'MH',
    [CountryCode.Martinique]: 'MQ',
    [CountryCode.Mauritania]: 'MR',
    [CountryCode.Mauritius]: 'MU',
    [CountryCode.Mayotte]: 'YT',
    [CountryCode.Mexico]: 'MX',
    [CountryCode['Micronesia (Federated States of)']]: 'FM',
    [CountryCode['Moldova (the Republic of)']]: 'MD',
    [CountryCode.Monaco]: 'MC',
    [CountryCode.Mongolia]: 'MN',
    [CountryCode.Montenegro]: 'ME',
    [CountryCode.Montserrat]: 'MS',
    [CountryCode.Morocco]: 'MA',
    [CountryCode.Mozambique]: 'MZ',
    [CountryCode.Myanmar]: 'MM',
    [CountryCode.Namibia]: 'NA',
    [CountryCode.Nauru]: 'NR',
    [CountryCode.Nepal]: 'NP',
    [CountryCode['Netherlands (the)']]: 'NL',
    [CountryCode['New Caledonia']]: 'NC',
    [CountryCode['New Zealand']]: 'NZ',
    [CountryCode.Nicaragua]: 'NI',
    [CountryCode['Niger (the)']]: 'NE',
    [CountryCode.Nigeria]: 'NG',
    [CountryCode.Niue]: 'NU',
    [CountryCode['Norfolk Island']]: 'NF',
    [CountryCode['Northern Mariana Islands (the)']]: 'MP',
    [CountryCode.Norway]: 'NO',
    [CountryCode.Oman]: 'OM',
    [CountryCode.Pakistan]: 'PK',
    [CountryCode.Palau]: 'PW',
    [CountryCode['Palestine, State of']]: 'PS',
    [CountryCode.Panama]: 'PA',
    [CountryCode['Papua New Guinea']]: 'PG',
    [CountryCode.Paraguay]: 'PY',
    [CountryCode.Peru]: 'PE',
    [CountryCode['Philippines (the)']]: 'PH',
    [CountryCode.Pitcairn]: 'PN',
    [CountryCode.Poland]: 'PL',
    [CountryCode.Portugal]: 'PT',
    [CountryCode['Puerto Rico']]: 'PR',
    [CountryCode.Qatar]: 'QA',
    [CountryCode['Republic of North Macedonia']]: 'MK',
    [CountryCode.Romania]: 'RO',
    [CountryCode['Russian Federation (the)']]: 'RU',
    [CountryCode.Rwanda]: 'RW',
    [CountryCode.Réunion]: 'RE',
    [CountryCode['Saint Barthélemy']]: 'BL',
    [CountryCode['Saint Helena, Ascension and Tristan da Cunha']]: 'SH',
    [CountryCode['Saint Kitts and Nevis']]: 'KN',
    [CountryCode['Saint Lucia']]: 'LC',
    [CountryCode['Saint Martin (French part)']]: 'MF',
    [CountryCode['Saint Pierre and Miquelon']]: 'PM',
    [CountryCode['Saint Vincent and the Grenadines']]: 'VC',
    [CountryCode.Samoa]: 'WS',
    [CountryCode['San Marino']]: 'SM',
    [CountryCode['Sao Tome and Principe']]: 'ST',
    [CountryCode['Saudi Arabia']]: 'SA',
    [CountryCode.Senegal]: 'SN',
    [CountryCode.Serbia]: 'RS',
    [CountryCode.Seychelles]: 'SC',
    [CountryCode['Sierra Leone']]: 'SL',
    [CountryCode.Singapore]: 'SG',
    [CountryCode['Sint Maarten (Dutch part)']]: 'SX',
    [CountryCode.Slovakia]: 'SK',
    [CountryCode.Slovenia]: 'SI',
    [CountryCode['Solomon Islands']]: 'SB',
    [CountryCode.Somalia]: 'SO',
    [CountryCode['South Africa']]: 'ZA',
    [CountryCode['South Georgia and the South Sandwich Islands']]: 'GS',
    [CountryCode['South Sudan']]: 'SS',
    [CountryCode.Spain]: 'ES',
    [CountryCode['Sri Lanka']]: 'LK',
    [CountryCode['Sudan (the)']]: 'SD',
    [CountryCode.Suriname]: 'SR',
    [CountryCode['Svalbard and Jan Mayen']]: 'SJ',
    [CountryCode.Sweden]: 'SE',
    [CountryCode.Switzerland]: 'CH',
    [CountryCode['Syrian Arab Republic']]: 'SY',
    [CountryCode['Taiwan (Province of China)']]: 'TW',
    [CountryCode.Tajikistan]: 'TJ',
    [CountryCode['Tanzania, United Republic of']]: 'TZ',
    [CountryCode.Thailand]: 'TH',
    [CountryCode['Timor-Leste']]: 'TL',
    [CountryCode.Togo]: 'TG',
    [CountryCode.Tokelau]: 'TK',
    [CountryCode.Tonga]: 'TO',
    [CountryCode['Trinidad and Tobago']]: 'TT',
    [CountryCode.Tunisia]: 'TN',
    [CountryCode.Turkey]: 'TR',
    [CountryCode.Turkmenistan]: 'TM',
    [CountryCode['Turks and Caicos Islands (the)']]: 'TC',
    [CountryCode.Tuvalu]: 'TV',
    [CountryCode.Uganda]: 'UG',
    [CountryCode.Ukraine]: 'UA',
    [CountryCode['United Arab Emirates (the)']]: 'AE',
    [CountryCode['United Kingdom of Great Britain and Northern Ireland (the)']]: 'GB',
    [CountryCode['United States Minor Outlying Islands (the)']]: 'UM',
    [CountryCode['United States of America (the)']]: 'US',
    [CountryCode.Uruguay]: 'UY',
    [CountryCode.Uzbekistan]: 'UZ',
    [CountryCode.Vanuatu]: 'VU',
    [CountryCode['Venezuela (Bolivarian Republic of)']]: 'VE',
    [CountryCode['Viet Nam']]: 'VN',
    [CountryCode['Virgin Islands (British)']]: 'VG',
    [CountryCode['Virgin Islands (U.S.)']]: 'VI',
    [CountryCode['Wallis and Futuna']]: 'WF',
    [CountryCode['Western Sahara']]: 'EH',
    [CountryCode.Yemen]: 'YE',
    [CountryCode.Zambia]: 'ZM',
    [CountryCode.Zimbabwe]: 'ZW',
  };

  const greenInvoiceCountry = countryCodeToGreenInvoiceMap[countryCode];
  if (greenInvoiceCountry) {
    return greenInvoiceCountry;
  }
  throw new Error(`Unsupported country code: ${countryCode}`);
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
  const documentType = normalizeGreenInvoiceDocumentType(greenInvoiceDoc.type);
  const isOwnerCreditor = greenInvoiceDoc.amount > 0 && documentType !== DocumentType.CreditInvoice;

  const links = await injector.get(GreenInvoiceClientProvider).getDocumentLinks(greenInvoiceDoc.id);
  if (!links) {
    throw new GraphQLError(`No links found for Green Invoice document ID: ${greenInvoiceDoc.id}`);
  }

  const fileUrl = links.en ?? links.origin;

  try {
    // generate preview image via cloudinary
    const imagePromise = injector.get(CloudinaryProvider).uploadInvoiceToCloudinary(fileUrl);

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
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          // Handle error, maybe log and continue with null hash
          throw new Error(`Failed to fetch file from GreenInvoice: ${fileUrl}`);
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

      const charge = await injector.get(ChargesProvider).generateCharge({
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
      file: fileUrl,
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
  initialInput: DocumentIssueInput,
  injector: Injector,
): Promise<_DOLLAR_defs_DocumentInputNew_Input> {
  let client: _DOLLAR_defs_addDocumentRequest_Input['client'] | undefined = undefined;
  if (initialInput.client) {
    const clientInfo = await injector
      .get(ClientsProvider)
      .getClientByIdLoader.load(initialInput.client.id);
    if (!clientInfo) {
      throw new GraphQLError(`Client with business ID ${initialInput.client.id} not found`);
    }
    let greenInvoiceId: string | null = null;
    try {
      greenInvoiceId =
        validateClientIntegrations(clientInfo.integrations ?? {}).greenInvoiceId ?? null;
    } catch (error) {
      console.error('Failed to validate client integrations', error);
      throw new GraphQLError(
        `Client with business ID ${initialInput.client.id} has invalid integrations`,
      );
    }
    if (!greenInvoiceId) {
      throw new GraphQLError(
        `Client with business ID ${initialInput.client.id} not found in Green Invoice`,
      );
    }
    const greenInvoiceClient = await injector
      .get(GreenInvoiceClientProvider)
      .clientLoader.load(greenInvoiceId);
    if (!greenInvoiceClient) {
      throw new GraphQLError(`Green Invoice client with ID ${greenInvoiceId} not found`);
    }
    const emails: (string | null)[] = ['ap@the-guild.dev']; // TODO: remove hardcoded email
    const inputEmails = initialInput.client?.emails?.filter(Boolean) ?? [];
    if (inputEmails.length) {
      emails.push(...inputEmails);
    } else {
      emails.push(...(greenInvoiceClient.emails ?? []));
    }
    // TODO: use local values
    client = {
      id: greenInvoiceClient.id,
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

  // clean input by converting to writeable and removing unwanted properties
  const cleanedInput: Partial<{
    -readonly [P in keyof DocumentIssueInput]: DocumentIssueInput[P];
  }> = { ...initialInput };
  delete cleanedInput.language;

  const input: _DOLLAR_defs_DocumentInputNew_Input = {
    ...cleanedInput,
    currency: convertCurrencyToGreenInvoice(initialInput.currency),
    type: getGreenInvoiceDocumentType(initialInput.type),
    lang: getGreenInvoiceDocumentLanguage(initialInput.language),
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
      subType: undefined,
      appType: undefined,
      cardType: payment.cardType
        ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
        : undefined,
      dealType: undefined,
      currency: convertCurrencyToGreenInvoice(payment.currency),
    })),
    linkedDocumentIds: initialInput.linkedDocumentIds?.length
      ? [...initialInput.linkedDocumentIds]
      : undefined,
    linkType: initialInput.linkType
      ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
      : undefined,
  };
  return input;
}

export async function convertGreenInvoiceDocumentToDocumentDraft(
  greenInvoiceDocument: _DOLLAR_defs_Document,
  injector: Injector,
): Promise<ResolversTypes['DocumentDraft']> {
  const client = await (greenInvoiceDocument.client?.id
    ? injector
        .get(ClientsProvider)
        .getClientByGreenInvoiceIdLoader.load(greenInvoiceDocument.client?.id)
    : Promise.resolve(undefined));
  return {
    ...greenInvoiceDocument,
    client,
    currency: greenInvoiceDocument.currency as Currency,
    income: greenInvoiceDocument.income?.filter(Boolean).map(income => ({
      ...income!,
      currency: income!.currency as Currency,
      vatType: getVatTypeFromGreenInvoiceDocument(income!.vatType),
    })),
    language: getLanguageFromGreenInvoiceDocument(greenInvoiceDocument.lang),
    payment: greenInvoiceDocument.payment?.filter(Boolean).map(payment => ({
      ...payment!,
      appType: undefined,
      cardType: payment?.cardType
        ? getCardTypeFromGreenInvoiceDocumentPayment(payment.cardType)
        : undefined,
      currency: payment!.currency as Currency,
      dealType: undefined,
      subType: undefined,
      type: getTypeFromGreenInvoiceDocumentPayment(payment!.type),
    })),
    type: getTypeFromGreenInvoiceDocument(greenInvoiceDocument.type),
    vatType: getVatTypeFromGreenInvoiceDocument(greenInvoiceDocument.vatType),
  };
}
