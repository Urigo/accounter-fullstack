import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    documents: [Document!]! @auth(role: ACCOUNTANT)
    documentsByFilters(filters: DocumentsFilters!): [Document!]! @auth(role: ACCOUNTANT)
    documentById(documentId: UUID!): Document @auth(role: ACCOUNTANT)
  }

  " input variables for documents filtering "
  input DocumentsFilters {
    businessIDs: [UUID!]
    ownerIDs: [UUID!]
    fromDate: TimelessDate
    toDate: TimelessDate
    " Include only documents without matching transactions "
    unmatched: Boolean
  }

  extend type Mutation {
    insertDocument(record: InsertDocumentInput!): InsertDocumentResult! @auth(role: ACCOUNTANT)
    updateDocument(documentId: UUID!, fields: UpdateDocumentFieldsInput!): UpdateDocumentResult!
      @auth(role: ACCOUNTANT)
    deleteDocument(documentId: UUID!): Boolean! @auth(role: ACCOUNTANT)
    uploadDocument(file: FileScalar!, chargeId: UUID): UploadDocumentResult! @auth(role: ACCOUNTANT)
    fetchIncomeDocuments(ownerId: UUID!): [Document!]! @auth(role: ADMIN)
    generateMonthlyClientDocuments: GenerateMonthlyClientDocumentsResult! @auth(role: ACCOUNTANT)
    batchUploadDocuments(
      documents: [FileScalar!]!
      isSensitive: Boolean
      chargeId: UUID
    ): [UploadDocumentResult!]! @auth(role: ACCOUNTANT)
    batchUploadDocumentsFromGoogleDrive(
      sharedFolderUrl: String!
      isSensitive: Boolean
      chargeId: UUID
    ): [UploadDocumentResult!]! @auth(role: ACCOUNTANT)
  }

  " All possible document types "
  enum DocumentType {
    INVOICE
    RECEIPT
    INVOICE_RECEIPT
    CREDIT_INVOICE
    PROFORMA
    UNPROCESSED
    OTHER
  }

  " represent a link to an external file "
  interface Linkable {
    file: URL
  }

  " represent a generic document with identifier and a URL "
  interface Document implements Linkable {
    id: UUID!
    " previewable image "
    image: URL
    " link to original file gmail, pdf "
    file: URL
    " the specific type of the document"
    # eslint-disable-next-line @graphql-eslint/no-typename-prefix
    documentType: DocumentType
    isReviewed: Boolean
  }

  " document that haven't yet been processed"
  type Unprocessed implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    documentType: DocumentType
    isReviewed: Boolean
  }

  " processed non-financial document "
  type OtherDocument implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    documentType: DocumentType
    isReviewed: Boolean
  }

  " represent a financial document "
  interface FinancialDocument implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " invoice document "
  type Invoice implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " proforma document "
  type Proforma implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " receipt document "
  type Receipt implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    documentType: DocumentType
    vat: FinancialAmount
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    isReviewed: Boolean
    allocationNumber: String
  }

  " Invoice receipt document - חשבונית מס קבלה "
  type InvoiceReceipt implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " Credit invoice document - חשבונית זיכוי "
  type CreditInvoice implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " input variables for updateDocument "
  input UpdateDocumentFieldsInput {
    vat: FinancialAmountInput
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmountInput
    documentType: DocumentType
    image: URL
    file: URL
    chargeId: UUID
    creditorId: UUID
    debtorId: UUID
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " result type for updateCharge "
  union UpdateDocumentResult = UpdateDocumentSuccessfulResult | CommonError

  " result type for updateDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type UpdateDocumentSuccessfulResult {
    document: Document
  }

  " input variables for insertDocument "
  input InsertDocumentInput {
    image: URL
    file: URL
    vat: FinancialAmountInput
    documentType: DocumentType
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmountInput
    chargeId: UUID
    creditorId: UUID
    debtorId: UUID
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
  }

  " result type for insertDocument "
  union InsertDocumentResult = InsertDocumentSuccessfulResult | CommonError

  " result type for insertDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type InsertDocumentSuccessfulResult {
    document: Document
  }

  " result type for uploadDocument "
  union UploadDocumentResult = UploadDocumentSuccessfulResult | CommonError

  " result type for uploadDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type UploadDocumentSuccessfulResult {
    document: Document
  }

  " result type for generateMonthlyClientDocuments" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type GenerateMonthlyClientDocumentsResult {
    success: Boolean!
    errors: [String!]
  }

  extend interface Charge {
    " additional documents attached to the charge "
    additionalDocuments: [Document!]!
  }

  extend type CommonCharge {
    additionalDocuments: [Document!]!
  }

  extend type FinancialCharge {
    additionalDocuments: [Document!]!
  }

  extend type ConversionCharge {
    additionalDocuments: [Document!]!
  }

  extend type SalaryCharge {
    additionalDocuments: [Document!]!
  }

  extend type InternalTransferCharge {
    additionalDocuments: [Document!]!
  }

  extend type DividendCharge {
    additionalDocuments: [Document!]!
  }

  extend type BusinessTripCharge {
    additionalDocuments: [Document!]!
  }

  extend type MonthlyVatCharge {
    additionalDocuments: [Document!]!
  }

  extend type BankDepositCharge {
    additionalDocuments: [Document!]!
  }

  extend type CreditcardBankCharge {
    additionalDocuments: [Document!]!
  }
`;
