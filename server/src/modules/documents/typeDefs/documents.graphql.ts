import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    documents: [Document!]!
    documentsByFilters(filters: DocumentsFilters!): [Document!]!
  }

  " input variables for documents filtering "
  input DocumentsFilters {
    businessIDs: [ID!]
    ownerIDs: [ID!]
    fromDate: TimelessDate
    toDate: TimelessDate
    " Include only documents without matching transactions "
    unmatched: Boolean
  }

  extend type Mutation {
    insertDocument(record: InsertDocumentInput!): InsertDocumentResult!
    updateDocument(documentId: ID!, fields: UpdateDocumentFieldsInput!): UpdateDocumentResult!
    deleteDocument(documentId: ID!): Boolean!
    fetchEmailDocument(url: URL!): FetchEmailDocumentResult!
    uploadDocument(file: FileScalar!, chargeId: ID): UploadDocumentResult!
    fetchIncomeDocuments(ownerId: ID!): [Document!]!
  }

  " All possible document types "
  enum DocumentType {
    INVOICE
    RECEIPT
    INVOICE_RECEIPT
    PROFORMA
    UNPROCESSED
  }

  " represent a link to an external file "
  interface Linkable {
    file: URL
  }

  " represent a generic document with identifier and a URL "
  interface Document implements Linkable {
    id: ID!
    " previewable image "
    image: URL
    " link to original file gmail, pdf "
    file: URL
    " the specific type of the document"
    # eslint-disable-next-line @graphql-eslint/no-typename-prefix
    documentType: DocumentType
    isReviewed: Boolean
    isValid: Boolean!
  }

  " document that haven't yet been processed"
  type Unprocessed implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    charge: Charge
    documentType: DocumentType
    isReviewed: Boolean
    isValid: Boolean!
  }

  " invoice document "
  type Invoice implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    charge: Charge
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    isValid: Boolean!
  }

  " proforma document "
  type Proforma implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    isValid: Boolean!
  }

  " receipt document "
  type Receipt implements Document & Linkable {
    id: ID!
    " previewable image "
    image: URL
    " gmail, pdf "
    file: URL
    documentType: DocumentType
    vat: FinancialAmount
    invoice: Invoice
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    isReviewed: Boolean
    isValid: Boolean!
  }

  " Invoice receipt document - חשבונית מס קבלה "
  type InvoiceReceipt implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    isValid: Boolean!
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
    chargeId: ID
    creditorId: UUID
    debtorId: UUID
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
    chargeId: ID
    creditorId: UUID
    debtorId: UUID
  }

  " result type for insertDocument "
  union InsertDocumentResult = InsertDocumentSuccessfulResult | CommonError

  " result type for insertDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type InsertDocumentSuccessfulResult {
    document: Document
  }

  " result type for fetchEmailDocument "
  union FetchEmailDocumentResult = FetchEmailDocumentSuccessfulResult | CommonError

  " result type for fetchEmailDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type FetchEmailDocumentSuccessfulResult {
    document: Document
  }

  " result type for uploadDocument "
  union UploadDocumentResult = UploadDocumentSuccessfulResult | CommonError

  " result type for uploadDocument" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type UploadDocumentSuccessfulResult {
    document: Document
  }

  " represent every kind of invoice document "
  union BroadInvoice = Invoice | InvoiceReceipt

  " represent every kind of receipt document "
  union BroadReceipt = Receipt | InvoiceReceipt

  extend type Charge {
    " additional documents attached to the charge "
    additionalDocuments: [Document!]!
    " linked invoice document "
    invoice: BroadInvoice
    " linked receipt document "
    receipt: BroadReceipt
  }

  extend type LtdFinancialEntity {
    documents: [Document]
  }

  extend type PersonalFinancialEntity {
    documents: [Document]
  }

  extend interface FinancialEntity {
    documents: [Document]
  }
`;
