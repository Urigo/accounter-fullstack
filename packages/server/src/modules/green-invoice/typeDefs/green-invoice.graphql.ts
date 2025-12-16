import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    newDocumentInfoDraftByCharge(chargeId: UUID!): NewDocumentInfo! @auth(role: ACCOUNTANT)
    newDocumentInfoDraftByDocument(documentId: UUID!): NewDocumentInfo! @auth(role: ACCOUNTANT)
    clientMonthlyChargesDrafts(issueMonth: TimelessDate!): [NewDocumentInfo!]!
      @auth(role: ACCOUNTANT)
    clientChargesDraftsByContracts(
      issueMonth: TimelessDate!
      contractIds: [UUID!]!
    ): [NewDocumentInfo!]! @auth(role: ACCOUNTANT)
    clientMonthlyChargeDraft(clientId: UUID!, issueMonth: TimelessDate!): NewDocumentInfo!
      @auth(role: ACCOUNTANT)
    greenInvoiceClient(clientId: UUID!): GreenInvoiceClient! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    syncGreenInvoiceDocuments(ownerId: UUID!, singlePageLimit: Boolean): [Document!]!
      @auth(role: ADMIN)
    issueGreenInvoiceDocuments(
      generateDocumentsInfo: [NewDocumentInput!]!
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
  extend type IssuedDocumentInfo {
    originalDocument: NewDocumentInfo
  }

  extend type ClientIntegrations {
    greenInvoiceInfo: GreenInvoiceClient
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
    country: Country
    emails: [String!]
    greenInvoiceId: ID
    businessId: UUID!
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
    country: CountryCode
    emails: [String!]
    greenInvoiceId: String
    businessId: UUID!
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
