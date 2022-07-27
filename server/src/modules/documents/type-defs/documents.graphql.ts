import { gql } from 'graphql-modules';

export const documentsSchema = gql`
  " All possible document types "
  enum DocumentType {
    INVOICE
    RECEIPT
    INVOICE_RECEIPT
    PROFORMA
    UNPROCESSED
  }

  extend type Query {
    documents: [Document!]!
  }

  extend type Mutation {
    insertDocument(record: InsertDocumentInput!): InsertDocumentResult!
    updateDocument(documentId: ID!, fields: UpdateDocumentFieldsInput!): UpdateDocumentResult!
    deleteDocument(documentId: ID!): Boolean!
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
    charge: Charge
    " the specific type of the document"
    documentType: DocumentType
    creditor: String
    debtor: String
    isReviewed: Boolean
  }

  " document that haven't yet been processed"
  type Unprocessed implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    charge: Charge
    documentType: DocumentType
    creditor: String
    debtor: String
    isReviewed: Boolean
  }

  " invoice document "
  type Invoice implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    charge: Charge
    documentType: DocumentType
    creditor: String
    debtor: String
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
  }

  " proforma document "
  type Proforma implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    charge: Charge
    documentType: DocumentType
    creditor: String
    debtor: String
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
  }

  " receipt document "
  type Receipt implements Document & Linkable {
    id: ID!
    " previewable image "
    image: URL
    " gmail, pdf "
    file: URL
    charge: Charge
    documentType: DocumentType
    vat: FinancialAmount
    invoice: Invoice
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    creditor: String
    debtor: String
    isReviewed: Boolean
  }

  " Invoice receipt document - חשבונית מס קבלה "
  type InvoiceReceipt implements Document & Linkable {
    id: ID!
    image: URL
    file: URL
    vat: FinancialAmount
    charge: Charge
    documentType: DocumentType
    creditor: String
    debtor: String
    isReviewed: Boolean

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
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
    creditor: String
    debtor: String
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
    creditor: String
    debtor: String
  }

  " result type for updateCharge "
  union UpdateDocumentResult = UpdateDocumentSuccessfulResult | CommonError

  " result type for updateDocument"
  type UpdateDocumentSuccessfulResult {
    document: Document
  }

  " result type for insertDocument "
  union InsertDocumentResult = InsertDocumentSuccessfulResult | CommonError

  " result type for insertDocument"
  type InsertDocumentSuccessfulResult {
    document: Document
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
`;
