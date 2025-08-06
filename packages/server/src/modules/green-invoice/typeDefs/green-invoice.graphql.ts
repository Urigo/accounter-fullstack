import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    greenInvoiceBusiness(businessId: UUID!): GreenInvoiceBusiness! @auth(role: ACCOUNTANT)
    greenInvoiceBusinesses: [GreenInvoiceBusiness!]! @auth(role: ACCOUNTANT)
    newDocumentInfoDraftByCharge(chargeId: UUID!): NewDocumentInfo! @auth(role: ACCOUNTANT)
    newDocumentInfoDraftByDocument(documentId: UUID!): NewDocumentInfo! @auth(role: ACCOUNTANT)
  }
  extend type Mutation {
    fetchIncomeDocuments(ownerId: UUID!, singlePageLimit: Boolean): [Document!]! @auth(role: ADMIN)
    generateMonthlyClientDocuments(
      issueMonth: TimelessDate
      generateDocumentsInfo: [GenerateDocumentInfo!]!
    ): GenerateMonthlyClientDocumentsResult! @auth(role: ACCOUNTANT)
    previewGreenInvoiceDocument(input: NewDocumentInput!): FileScalar! @auth(role: ACCOUNTANT)
    issueGreenInvoiceDocument(
      input: NewDocumentInput!
      emailContent: String
      attachment: Boolean
      chargeId: UUID
      sendEmail: Boolean
    ): Charge! @auth(role: ACCOUNTANT)
  }

  " business extended with green invoice data "
  type GreenInvoiceBusiness {
    id: UUID!
    originalBusiness: LtdFinancialEntity!
    greenInvoiceId: UUID!
    remark: String
    emails: [String!]!
    generatedDocumentType: DocumentType!
    clientInfo: GreenInvoiceClient!
  }

  " input for generating monthly client document "
  input GenerateDocumentInfo {
    businessId: UUID!
    amount: FinancialAmountInput!
  }

  " result type for generateMonthlyClientDocuments" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type GenerateMonthlyClientDocumentsResult {
    success: Boolean!
    errors: [String!]
  }

  " for previewing/issuing document "
  type NewDocumentInfo {
    description: String
    remarks: String
    footer: String
    type: DocumentType!
    date: String
    dueDate: String
    lang: GreenInvoiceDocumentLang!
    currency: Currency!
    vatType: GreenInvoiceVatType!
    discount: GreenInvoiceDiscount
    rounding: Boolean
    signed: Boolean
    maxPayments: Int
    client: GreenInvoiceClient
    income: [GreenInvoiceIncome!]
    payment: [GreenInvoicePayment!]
    linkedDocumentIds: [String!]
    linkedPaymentId: String
    linkType: GreenInvoiceLinkType
  }

  " discount info "
  type GreenInvoiceDiscount {
    amount: Float!
    type: GreenInvoiceDiscountType!
  }

  " client info "
  type GreenInvoiceClient {
    country: GreenInvoiceCountry
    emails: [String!]
    id: ID!
    name: String
    phone: String
    taxId: String
    self: Boolean
    address: String
    city: String
    zip: String
    fax: String
    mobile: String
    add: Boolean
  }

  " income info "
  type GreenInvoiceIncome {
    currency: Currency!
    currencyRate: Float
    description: String!
    itemId: String
    price: Float!
    quantity: Float!
    vatRate: Float
    vatType: GreenInvoiceVatType!
  }

  " payment info "
  type GreenInvoicePayment {
    currency: Currency!
    currencyRate: Float
    date: String
    price: Float!
    type: GreenInvoicePaymentType!
    subType: GreenInvoicePaymentSubType
    bankName: String
    bankBranch: String
    bankAccount: String
    chequeNum: String
    accountId: String
    transactionId: String
    appType: GreenInvoicePaymentAppType
    cardType: GreenInvoicePaymentCardType
    cardNum: String
    dealType: GreenInvoicePaymentDealType
    numPayments: Int
    firstPayment: Float
  }

  " input for previewing document "
  input NewDocumentInput {
    description: String
    remarks: String
    footer: String
    type: DocumentType!
    date: String
    dueDate: String
    lang: GreenInvoiceDocumentLang!
    currency: Currency!
    vatType: GreenInvoiceVatType!
    discount: GreenInvoiceDiscountInput
    rounding: Boolean
    signed: Boolean
    maxPayments: Int
    client: GreenInvoiceClientInput
    income: [GreenInvoicePaymentIncomeInput!]
    payment: [GreenInvoicePaymentInput!]
    linkedDocumentIds: [String!]
    linkedPaymentId: String
    linkType: GreenInvoiceLinkType
  }

  " discount input "
  input GreenInvoiceDiscountInput {
    amount: Float!
    type: GreenInvoiceDiscountType!
  }

  " client input "
  input GreenInvoiceClientInput {
    country: GreenInvoiceCountry
    emails: [String!]
    id: String!
    name: String
    phone: String
    taxId: String
    self: Boolean
    address: String
    city: String
    zip: String
    fax: String
    mobile: String
    add: Boolean
  }

  " income input "
  input GreenInvoicePaymentIncomeInput {
    amount: Float
    amountTotal: Float
    catalogNum: String
    currency: Currency!
    currencyRate: Float
    description: String!
    itemId: String
    price: Float!
    quantity: Float!
    vat: Float
    vatRate: Float
    vatType: GreenInvoiceVatType!
  }

  " payment input "
  input GreenInvoicePaymentInput {
    currency: Currency!
    currencyRate: Float
    date: String
    price: Float!
    type: GreenInvoicePaymentType!
    subType: GreenInvoicePaymentSubType
    bankName: String
    bankBranch: String
    bankAccount: String
    chequeNum: String
    accountId: String
    transactionId: String
    appType: GreenInvoicePaymentAppType
    cardType: GreenInvoicePaymentCardType
    cardNum: String
    dealType: GreenInvoicePaymentDealType
    numPayments: Int
    firstPayment: Float
  }

  " document language enum "
  enum GreenInvoiceDocumentLang {
    ENGLISH
    HEBREW
  }

  " VAT type enum "
  enum GreenInvoiceVatType {
    DEFAULT
    EXEMPT
    MIXED
  }

  " discount type enum "
  enum GreenInvoiceDiscountType {
    SUM
    PERCENTAGE
  }

  " country enum (abbreviated for brevity - add more as needed) "
  enum GreenInvoiceCountry {
    UG
    UZ
    AT
    AU
    UA
    UY
    AZ
    CX
    AE
    IT
    BS
    GS
    UM
    VI
    VG
    HM
    TC
    MP
    MH
    SB
    FO
    FK
    FJ
    KM
    CK
    CC
    KY
    ID
    IS
    IE
    IR
    SV
    AL
    DZ
    AX
    AO
    AI
    AD
    AQ
    AG
    EE
    AF
    EC
    AR
    US
    AW
    ER
    AM
    ET
    BT
    BV
    BW
    BG
    BO
    BA
    BI
    BF
    BH
    BY
    BE
    BZ
    BD
    BJ
    BB
    BN
    BR
    GB
    BM
    DJ
    JM
    JE
    GA
    GE
    GH
    GT
    GU
    GP
    GY
    GI
    GN
    GW
    GQ
    GF
    GM
    GL
    DE
    GD
    GG
    DM
    DK
    ZA
    SS
    KR
    IM
    NF
    HT
    MV
    BQ
    IN
    NL
    HK
    HU
    HN
    IO
    TF
    PH
    DO
    CD
    CF
    PS
    WF
    VN
    VU
    VE
    VA
    ZW
    ZM
    CI
    TJ
    TV
    TG
    TO
    TN
    TK
    TR
    TM
    TW
    TZ
    TT
    GR
    JP
    JO
    IL
    KW
    CV
    LA
    LB
    LY
    LU
    LV
    LR
    LT
    LI
    LS
    MR
    MU
    ML
    MG
    MZ
    MD
    MN
    ME
    MS
    MC
    TL
    MM
    YT
    FM
    MW
    MY
    MT
    EG
    MO
    MK
    MX
    MA
    MQ
    NR
    NO
    NG
    NZ
    NU
    NE
    NI
    NA
    NP
    ST
    SJ
    EH
    SD
    SZ
    SO
    SY
    SR
    SL
    SC
    CN
    SG
    SI
    SK
    WS
    AS
    BL
    MF
    SM
    PM
    SN
    SH
    VC
    LC
    SX
    KN
    SA
    ES
    RS
    LK
    OM
    IQ
    PW
    PL
    PF
    PR
    PT
    PN
    FI
    PA
    PG
    PK
    PY
    PE
    TD
    CL
    CZ
    KP
    FR
    CU
    CO
    CG
    XK
    CR
    CW
    KZ
    QA
    KG
    KI
    NC
    KH
    CM
    CA
    KE
    CY
    HR
    RE
    RW
    RO
    RU
    SE
    CH
    TH
    YE
  }

  " payment sub type enum "
  enum GreenInvoicePaymentSubType {
    BITCOIN
    MONEY_EQUAL
    V_CHECK
    GIFT_CARD
    NII_EMPLOYEE_DEDUCTION
    ETHEREUM
    BUYME_VOUCHER
    PAYONEER
  }

  " payment app type enum "
  enum GreenInvoicePaymentAppType {
    BIT
    PAY_BY_PEPPER
    PAYBOX
    CULO
    GOOGLE_PAY
    APPLE_PAY
  }

  " card type enum "
  enum GreenInvoicePaymentCardType {
    UNKNOWN
    ISRACARD
    VISA
    MASTERCARD
    AMERICAN_EXPRESS
    DINERS
  }

  " deal type enum "
  enum GreenInvoicePaymentDealType {
    STANDARD
    PAYMENTS
    CREDIT
    DEFERRED
    OTHER
    RECURRING
  }

  " payment type enum "
  enum GreenInvoicePaymentType {
    TAX_DEDUCTION
    CASH
    CHEQUE
    CREDIT_CARD
    WIRE_TRANSFER
    PAYPAL
    OTHER_DEDUCTION
    PAYMENT_APP
    OTHER
  }

  " link type enum "
  enum GreenInvoiceLinkType {
    LINK
    CANCEL
  }
`;
