enum DocumentLang {
  English = 'en',
  Hebrew = 'he',
}

enum Currency {
  IsraeliShekel = 'ILS',
  USDollar = 'USD',
  Euro = 'EUR',
  BritishPound = 'GBP',
  JapaneseYen = 'JPY',
  SwissFranc = 'CHF',
  ChineseYuan = 'CNY',
  AustralianDollar = 'AUD',
  CanadianDollar = 'CAD',
  RussianRuble = 'RUB',
  BrazilianReal = 'BRL',
  HongKongDollar = 'HKD',
  SingaporeDollar = 'SGD',
  ThaiBaht = 'THB',
  MexicanPeso = 'MXN',
  TurkishLira = 'TRY',
  NewZealandDollar = 'NZD',
  SwedishKrona = 'SEK',
  NorwegianKrone = 'NOK',
  DanishKrone = 'DKK',
  SouthKoreanWon = 'KRW',
  IndianRupee = 'INR',
  IndonesianRupiah = 'IDR',
  PolishZloty = 'PLN',
  RomanianLeu = 'RON',
  SouthAfricanRand = 'ZAR',
  CroatianKuna = 'HRK',
}

enum VatType {
  /** Default (Based on business type) */
  Default = '0',
  /** Exempt (VAT free) */
  Exempt = '1',
  /** Mixed (Contains exempt and due VAT income rows) */
  Mixed = '2',
}

enum DiscountType {
  Sum = 'sum',
  Percentage = 'percentage',
}

enum Country {
  Uganda = 'UG',
  Uzbekistan = 'UZ',
  Austria = 'AT',
  Australia = 'AU',
  Ukraine = 'UA',
  Uruguay = 'UY',
  Azerbaijan = 'AZ',
  ChristmasIsland = 'CX',
  UnitedArabEmirates = 'AE',
  Italy = 'IT',
  Bahamas = 'BS',
  SouthGeorgiaAndTheSouthSandwichIslands = 'GS',
  UnitedStatesMinorOutlyingIslands = 'UM',
  USVirginIslands = 'VI',
  BritishVirginIslands = 'VG',
  HeardIslandAndMcDonaldIslands = 'HM',
  TurksAndCaicosIslands = 'TC',
  NorthernMarianaIslands = 'MP',
  MarshallIslands = 'MH',
  SolomonIslands = 'SB',
  FaroeIslands = 'FO',
  FalklandIslands = 'FK',
  Fiji = 'FJ',
  Comoros = 'KM',
  CookIslands = 'CK',
  CocosIslands = 'CC',
  CaymanIslands = 'KY',
  Indonesia = 'ID',
  Iceland = 'IS',
  Ireland = 'IE',
  Iran = 'IR',
  ElSalvador = 'SV',
  Albania = 'AL',
  Algeria = 'DZ',
  AlandIslands = 'AX',
  Angola = 'AO',
  Anguilla = 'AI',
  Andorra = 'AD',
  Antarctica = 'AQ',
  AntiguaAndBarbuda = 'AG',
  Estonia = 'EE',
  Afghanistan = 'AF',
  Ecuador = 'EC',
  Argentina = 'AR',
  UnitedStates = 'US',
  Aruba = 'AW',
  Eritrea = 'ER',
  Armenia = 'AM',
  Ethiopia = 'ET',
  Bhutan = 'BT',
  BouvetIsland = 'BV',
  Botswana = 'BW',
  Bulgaria = 'BG',
  Bolivia = 'BO',
  BosniaAndHerzegovina = 'BA',
  Burundi = 'BI',
  BurkinaFaso = 'BF',
  Bahrain = 'BH',
  Belarus = 'BY',
  Belgium = 'BE',
  Belize = 'BZ',
  Bangladesh = 'BD',
  Benin = 'BJ',
  Barbados = 'BB',
  Brunei = 'BN',
  Brazil = 'BR',
  UnitedKingdom = 'GB',
  Bermuda = 'BM',
  Djibouti = 'DJ',
  Jamaica = 'JM',
  Jersey = 'JE',
  Gabon = 'GA',
  Georgia = 'GE',
  Ghana = 'GH',
  Guatemala = 'GT',
  Guam = 'GU',
  Guadeloupe = 'GP',
  Guyana = 'GY',
  Gibraltar = 'GI',
  Guinea = 'GN',
  GuineaBissau = 'GW',
  EquatorialGuinea = 'GQ',
  FrenchGuiana = 'GF',
  Gambia = 'GM',
  Greenland = 'GL',
  Germany = 'DE',
  Grenada = 'GD',
  Guernsey = 'GG',
  Dominica = 'DM',
  Denmark = 'DK',
  SouthAfrica = 'ZA',
  SouthSudan = 'SS',
  SouthKorea = 'KR',
  IsleOfMan = 'IM',
  NorfolkIsland = 'NF',
  Haiti = 'HT',
  Maldives = 'MV',
  BonaireSintEustatiusAndSaba = 'BQ',
  India = 'IN',
  Netherlands = 'NL',
  HongKong = 'HK',
  Hungary = 'HU',
  Honduras = 'HN',
  BritishIndianOceanTerritory = 'IO',
  FrenchSouthernTerritories = 'TF',
  Philippines = 'PH',
  DominicanRepublic = 'DO',
  DemocraticRepublicOfTheCongo = 'CD',
  CentralAfricanRepublic = 'CF',
  Palestine = 'PS',
  WallisAndFutuna = 'WF',
  Vietnam = 'VN',
  Vanuatu = 'VU',
  Venezuela = 'VE',
  VaticanCity = 'VA',
  Zimbabwe = 'ZW',
  Zambia = 'ZM',
  CoteDIvoire = 'CI',
  Tajikistan = 'TJ',
  Tuvalu = 'TV',
  Togo = 'TG',
  Tonga = 'TO',
  Tunisia = 'TN',
  Tokelau = 'TK',
  Turkey = 'TR',
  Turkmenistan = 'TM',
  Taiwan = 'TW',
  Tanzania = 'TZ',
  TrinidadAndTobago = 'TT',
  Greece = 'GR',
  Japan = 'JP',
  Jordan = 'JO',
  Israel = 'IL',
  Kuwait = 'KW',
  CapeVerde = 'CV',
  Laos = 'LA',
  Lebanon = 'LB',
  Libya = 'LY',
  Luxembourg = 'LU',
  Latvia = 'LV',
  Liberia = 'LR',
  Lithuania = 'LT',
  Liechtenstein = 'LI',
  Lesotho = 'LS',
  Mauritania = 'MR',
  Mauritius = 'MU',
  Mali = 'ML',
  Madagascar = 'MG',
  Mozambique = 'MZ',
  Moldova = 'MD',
  Mongolia = 'MN',
  Montenegro = 'ME',
  Montserrat = 'MS',
  Monaco = 'MC',
  TimorLeste = 'TL',
  Myanmar = 'MM',
  Mayotte = 'YT',
  Micronesia = 'FM',
  Malawi = 'MW',
  Malaysia = 'MY',
  Malta = 'MT',
  Egypt = 'EG',
  Macao = 'MO',
  NorthMacedonia = 'MK',
  Mexico = 'MX',
  Morocco = 'MA',
  Martinique = 'MQ',
  Nauru = 'NR',
  Norway = 'NO',
  Nigeria = 'NG',
  NewZealand = 'NZ',
  Niue = 'NU',
  Niger = 'NE',
  Nicaragua = 'NI',
  Namibia = 'NA',
  Nepal = 'NP',
  SaoTomeAndPrincipe = 'ST',
  SvalbardAndJanMayen = 'SJ',
  WesternSahara = 'EH',
  Sudan = 'SD',
  Eswatini = 'SZ',
  Somalia = 'SO',
  Syria = 'SY',
  Suriname = 'SR',
  SierraLeone = 'SL',
  Seychelles = 'SC',
  China = 'CN',
  Singapore = 'SG',
  Slovenia = 'SI',
  Slovakia = 'SK',
  Samoa = 'WS',
  AmericanSamoa = 'AS',
  SaintBarthelemy = 'BL',
  SaintMartin = 'MF',
  SanMarino = 'SM',
  SaintPierreAndMiquelon = 'PM',
  Senegal = 'SN',
  SaintHelena = 'SH',
  SaintVincentAndTheGrenadines = 'VC',
  SaintLucia = 'LC',
  SintMaarten = 'SX',
  SaintKittsAndNevis = 'KN',
  SaudiArabia = 'SA',
  Spain = 'ES',
  Serbia = 'RS',
  SriLanka = 'LK',
  Oman = 'OM',
  Iraq = 'IQ',
  Palau = 'PW',
  Poland = 'PL',
  FrenchPolynesia = 'PF',
  PuertoRico = 'PR',
  Portugal = 'PT',
  PitcairnIslands = 'PN',
  Finland = 'FI',
  Panama = 'PA',
  PapuaNewGuinea = 'PG',
  Pakistan = 'PK',
  Paraguay = 'PY',
  Peru = 'PE',
  Chad = 'TD',
  Chile = 'CL',
  CzechRepublic = 'CZ',
  NorthKorea = 'KP',
  France = 'FR',
  Cuba = 'CU',
  Colombia = 'CO',
  RepublicOfTheCongo = 'CG',
  Kosovo = 'XK',
  CostaRica = 'CR',
  Curacao = 'CW',
  Kazakhstan = 'KZ',
  Qatar = 'QA',
  Kyrgyzstan = 'KG',
  Kiribati = 'KI',
  NewCaledonia = 'NC',
  Cambodia = 'KH',
  Cameroon = 'CM',
  Canada = 'CA',
  Kenya = 'KE',
  Cyprus = 'CY',
  Croatia = 'HR',
  Reunion = 'RE',
  Rwanda = 'RW',
  Romania = 'RO',
  Russia = 'RU',
  Sweden = 'SE',
  Switzerland = 'CH',
  Thailand = 'TH',
  Yemen = 'YE',
}

enum DocumentType {
  /** הצעת מחיר - Price Quote */
  PriceQuote = '10',
  /** הזמנה - Order */
  Order = '100',
  /** תעודת משלוח - Delivery Note */
  DeliveryNote = '200',
  /** תעודת החזרה - Return Note */
  ReturnNote = '210',
  /** חשבון עסקה - Transaction Invoice */
  TransactionInvoice = '300',
  /** חשבונית מס - Tax Invoice */
  TaxInvoice = '305',
  /** חשבונית מס / קבלה - Tax Invoice/Receipt */
  TaxInvoiceReceipt = '320',
  /** חשבונית זיכוי - Credit Note */
  CreditNote = '330',
  /** קבלה - Receipt */
  Receipt = '400',
  /** קבלה על תרומה - Donation Receipt */
  DonationReceipt = '405',
  /** הזמנת רכש - Purchase Order */
  PurchaseOrder = '500',
  /** קבלת פיקדון - Deposit Receipt */
  DepositReceipt = '600',
  /** משיכת פיקדון - Deposit Withdrawal */
  DepositWithdrawal = '610',
}

enum SubType {
  /** Bitcoin (ביטקוין) */
  Bitcoin = '1',
  /** Money-equal (שווה כסף) */
  MoneyEqual = '2',
  /** V-Check */
  VCheck = '3',
  /** Gift card (שובר מתנה) */
  GiftCard = '4',
  /** NII employee deduction (ניכוי חלק עובד ביטוח לאומי) */
  NIIEmployeeDeduction = '5',
  /** Ethereum (אתריום) */
  Ethereum = '6',
  /** BUYME Voucher (BUYME שובר) */
  BuyMeVoucher = '7',
  /** Payoneer */
  Payoneer = '8',
}

enum AppType {
  /** Bit */
  Bit = '1',
  /** Pay (by Pepper) */
  PayByPepper = '2',
  /** PayBox */
  PayBox = '3',
  /** Culo */
  Culo = '4',
  /** Google Pay */
  GooglePay = '5',
  /** Apple Pay */
  ApplePay = '6',
}

enum CardType {
  /** Unknown (לא ידוע) */
  Unknown = '0',
  /** Isracard (ישראכרט) */
  Isracard = '1',
  /** Visa (ויזה) */
  Visa = '2',
  /** Mastercard (מאסטרקארד) */
  Mastercard = '3',
  /** American Express (אמריקן אקספרס) */
  AmericanExpress = '4',
  /** Diners (דיינרס) */
  Diners = '5',
}

enum DealType {
  /** Standard (רגיל) */
  Standard = '1',
  /** Payments (תשלומים) */
  Payments = '2',
  /** Credit (קרדיט) */
  Credit = '3',
  /** Deferred (חיוב נדחה) */
  Deferred = '4',
  /** Other (אחר) */
  Other = '5',
  /** Recurring (הוראת קבע) */
  Recurring = '6',
}

enum PaymentType {
  /** Tax deduction (ניכוי במקור) */
  TaxDeduction = '0',
  /** Cash (מזומן) */
  Cash = '1',
  /** Cheque (צ׳ק) */
  Cheque = '2',
  /** Credit card (כרטיס אשראי) */
  CreditCard = '3',
  /** Wire-transfer (העברה בנקאית) */
  WireTransfer = '4',
  /** PayPal (פייפאל) */
  PayPal = '5',
  /** Other deduction (ניכוי אחר) */
  OtherDeduction = '9',
  /** Payment app (אפליקציית תשלום) */
  PaymentApp = '10',
  /** Other (אחר) */
  Other = '11',
}

enum LinkType {
  Link = 'link',
  Cancel = 'cancel',
}

type Discount = {
  amount: number;
  type: DiscountType;
};

type Client = {
  country?: Country;
  emails?: Array<string>;
  id: string;
  /** The client name */
  name?: string;
  phone?: string;
  /** The client tax ID */
  taxId?: string;
  /** Whether the client is self */
  self?: boolean;
  /** Client address */
  address?: string;
  /** Client city */
  city?: string;
  /** Client zip code */
  zip?: string;
  /** Client fax */
  fax?: string;
  /** The client mobile number */
  mobile?: string;
  /** Add a temporary client to the clients' list */
  add?: boolean;
};

type Income = {
  /** Amount */
  amount?: number;
  /** Total amount */
  amountTotal?: number;
  /** Catalog number */
  catalogNum?: string;
  currency: Currency;
  /** Currency rate relative to ILS */
  currencyRate?: number;
  /** Item description */
  description: string;
  /** The ID of the item to attach as income */
  itemId?: string;
  /** Item price */
  price: number;
  /** Quantity */
  quantity: number;
  /** VAT amount */
  vat?: number;
  /** VAT rate */
  vatRate?: number;
  vatType: VatType;
};

type Payment = {
  currency: Currency;
  /** Currency rate relative to ILS */
  currencyRate?: number;
  date?: string;
  price: number;
  type: PaymentType;
  subType?: SubType;
  /** Bank name (required when using Cheques) */
  bankName?: string;
  /** Bank branch number (required when using Cheques) */
  bankBranch?: string;
  /** Bank account number (required when using Cheques) */
  bankAccount?: string;
  /** Cheque number (required when using Cheques) */
  chequeNum?: string;
  /** Payer account (PayPal / Payment App / Other) */
  accountId?: string;
  /** Transaction ID (PayPal / Payment App / Other) */
  transactionId?: string;
  appType?: AppType;
  cardType?: CardType;
  /** Credit card's last 4 digits */
  cardNum?: string;
  dealType?: DealType;
  /** Credit card's payments count (1-36) */
  numPayments?: number; // integer
  /** Credit card's first payment */
  firstPayment?: number;
};

export type PreviewDocumentInput = {
  /** Document's description */
  description?: string;
  remarks?: string;
  /** Texts appearing in footer */
  footer?: string;
  type: DocumentType;
  /** Document date in the format YYYY-MM-DD */
  date?: string;
  /** Document payment due date in the format YYYY-MM-DD */
  dueDate?: string;
  lang: DocumentLang;
  currency: Currency;
  vatType: VatType;
  discount?: Discount;
  /** Round the amounts */
  rounding?: boolean;
  /** Digital sign the document */
  signed?: boolean;
  /** Max payments allowed (valid only on supported accounts) */
  maxPayments?: number; // integer
  client?: Client;
  income?: Array<Income>;
  payment?: Array<Payment>;
  /** Linked document IDs. allows you to state the related / relevant documents, e.g.: when creating a receipt, attach your original invoice document ID as one of the ids in the linkedDocumentIds - this in turn will automatically close the original invoice if needed. */
  linkedDocumentIds?: Array<string>;
  /** Linked payment ID (valid for document type 305 only). allows you to define the paymentId that the document is going to be relevant to, this can be attached only to invoice documents (type 305). */
  linkedPaymentId?: string;
  linkType?: LinkType;
};
