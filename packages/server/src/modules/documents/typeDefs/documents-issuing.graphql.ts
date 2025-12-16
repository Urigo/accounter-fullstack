import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    newDocumentDraftByCharge(chargeId: UUID!): DocumentDraft! @auth(role: ACCOUNTANT)
    newDocumentDraftByDocument(documentId: UUID!): DocumentDraft! @auth(role: ACCOUNTANT)
    periodicalDocumentDrafts(issueMonth: TimelessDate!): [DocumentDraft!]! @auth(role: ACCOUNTANT)
    periodicalDocumentDraftsByContracts(
      issueMonth: TimelessDate!
      contractIds: [UUID!]!
    ): [DocumentDraft!]! @auth(role: ACCOUNTANT)

    clientMonthlyChargeDraft(clientId: UUID!, issueMonth: TimelessDate!): DocumentDraft!
      @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    issueGreenInvoiceDocuments(
      generateDocumentsInfo: [DocumentIssueInput!]!
    ): GenerateDocumentsResult! @auth(role: ACCOUNTANT)
    issueGreenInvoiceDocument(
      input: DocumentIssueInput!
      emailContent: String
      attachment: Boolean
      chargeId: UUID
      sendEmail: Boolean
    ): Charge! @auth(role: ACCOUNTANT)
    previewDocument(input: DocumentIssueInput!): FileScalar! @auth(role: ACCOUNTANT)
  }

  " result type for generateDocuments" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type GenerateDocumentsResult {
    success: Boolean!
    errors: [String!]
  }

  " for previewing/issuing document "
  type DocumentDraft {
    description: String
    remarks: String
    footer: String
    type: DocumentType!
    date: String
    dueDate: String
    language: DocumentLanguage!
    currency: Currency!
    vatType: DocumentVatType!
    discount: DocumentDiscount
    rounding: Boolean
    signed: Boolean
    maxPayments: Int
    client: Client
    income: [DocumentIncomeRecord!]
    payment: [DocumentPaymentRecord!]
    linkedDocumentIds: [String!]
    linkedPaymentId: String
    linkType: DocumentLinkType
  }

  " income info "
  type DocumentIncomeRecord {
    currency: Currency!
    currencyRate: Float
    description: String!
    itemId: String
    price: Float!
    quantity: Float!
    vatRate: Float
    vatType: DocumentVatType!
  }

  " payment info "
  type DocumentPaymentRecord {
    currency: Currency!
    currencyRate: Float
    date: String
    price: Float!
    type: PaymentType!
    " subType: GreenInvoicePaymentSubType "
    bankName: String
    bankBranch: String
    bankAccount: String
    chequeNum: String
    accountId: String
    transactionId: String
    " appType: GreenInvoicePaymentAppType "
    cardType: DocumentPaymentRecordCardType
    cardNum: String
    " dealType: GreenInvoicePaymentDealType "
    numPayments: Int
    firstPayment: Float
  }

  " document discount info "
  type DocumentDiscount {
    amount: Float!
    type: DocumentDiscountType!
  }

  " document language enum "
  enum DocumentLanguage {
    ENGLISH
    HEBREW
  }

  " VAT type enum "
  enum DocumentVatType {
    DEFAULT
    EXEMPT
    MIXED
  }

  " discount type enum "
  enum DocumentDiscountType {
    SUM
    PERCENTAGE
  }

  " payment type enum "
  enum PaymentType {
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
  enum DocumentLinkType {
    LINK
    CANCEL
  }

  " card type enum "
  enum DocumentPaymentRecordCardType {
    UNKNOWN
    ISRACARD
    VISA
    MASTERCARD
    AMERICAN_EXPRESS
    DINERS
  }

  " input for issuing or previewing document "
  input DocumentIssueInput {
    description: String
    remarks: String
    footer: String
    type: DocumentType!
    date: String
    dueDate: String
    language: DocumentLanguage!
    currency: Currency!
    vatType: DocumentVatType!
    discount: DocumentDiscountInput
    rounding: Boolean
    signed: Boolean
    maxPayments: Int
    client: DocumentClientInput
    income: [DocumentIncomeRecordInput!]
    payment: [DocumentPaymentRecordInput!]
    linkedDocumentIds: [String!]
    linkedPaymentId: String
    linkType: DocumentLinkType
  }

  " discount input "
  input DocumentDiscountInput {
    amount: Float!
    type: DocumentDiscountType!
  }

  " client input "
  input DocumentClientInput {
    country: CountryCode
    emails: [String!]
    id: UUID!
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
  input DocumentIncomeRecordInput {
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
    vatType: DocumentVatType!
  }

  " payment input "
  input DocumentPaymentRecordInput {
    currency: Currency!
    currencyRate: Float
    date: String
    price: Float!
    type: PaymentType!
    bankName: String
    bankBranch: String
    bankAccount: String
    chequeNum: String
    accountId: String
    transactionId: String
    cardType: DocumentPaymentRecordCardType
    cardNum: String
    numPayments: Int
    firstPayment: Float
  }
`;
