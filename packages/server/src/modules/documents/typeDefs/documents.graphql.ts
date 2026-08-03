import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    documents: [Document!]! @requiresAuth
    documentsByFilters(filters: DocumentsFilters!): [Document!]! @requiresAuth
    documentById(documentId: UUID!): Document @requiresAuth
    documentsByIds(documentIds: [UUID!]!): [Document!]! @requiresAuth
    recentDocumentsByBusiness(businessId: UUID!, limit: Int): [Document!]! @requiresAuth
    recentDocumentsByClient(clientId: UUID!, limit: Int): [Document!]! @requiresAuth
    recentIssuedDocumentsByType(documentType: DocumentType!, limit: Int): [Document!]! @requiresAuth
  }

  " input variables for documents filtering "
  input DocumentsFilters {
    businessIDs: [UUID!]
    ownerIDs: [UUID!]
    " Include only documents linked to the given charges "
    chargeIDs: [UUID!]
    fromDate: TimelessDate
    toDate: TimelessDate
    " Include only documents without matching transactions "
    unmatched: Boolean
    " Include only documents of the given types "
    type: [DocumentType!]
    " Include only documents with a missing creditor or debtor "
    missingCounterparty: Boolean
    " Include only documents that fail basic information validation "
    missingInfo: Boolean
    " Free text search across serial number, amount, description, remarks and counterparty (creditor / debtor) names "
    freeText: String
  }

  extend type Mutation {
    insertDocument(record: InsertDocumentInput!): InsertDocumentResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDocument(documentId: UUID!, fields: UpdateDocumentFieldsInput!): UpdateDocumentResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteDocument(documentId: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    uploadDocument(file: FileScalar!, chargeId: UUID): UploadDocumentResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    batchUploadDocuments(
      documents: [FileScalar!]!
      isSensitive: Boolean
      chargeId: UUID
    ): [UploadDocumentResult!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    batchUploadDocumentsFromGoogleDrive(
      sharedFolderUrl: String!
      isSensitive: Boolean
      chargeId: UUID
    ): [UploadDocumentResult!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    closeDocument(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    chargeSpreadDocuments(chargeId: UUID!, documentIdsToKeep: [UUID!]): [Charge!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    description: String
    remarks: String
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
    description: String
    remarks: String
  }

  " document that haven't yet been processed"
  type Unprocessed implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    " financial metadata that may already be stored on the document even before it is classified as a financial document "
    vat: FinancialAmount
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
  }

  " processed non-financial document "
  type OtherDocument implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    " financial metadata that may already be stored on the document even though it is classified as a non-financial document "
    vat: FinancialAmount
    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
  }

  " result of a single document validation check "
  type DocumentValidationCheck {
    " whether this specific check passed "
    isValid: Boolean!
    " explanatory message when the check fails "
    message: String
  }

  " combined validation info for a financial document, aggregating all validation checks "
  type DocumentValidationInfo {
    " the validated document's ID "
    documentId: UUID!
    " true only when every validation check passes "
    isValid: Boolean!
    " human readable list of all detected validation issues "
    issues: [String!]!
    " basic required-fields validation (see basicDocumentValidation) "
    basicValidation: DocumentValidationCheck!
    " VAT amount validation "
    vatValidation: DocumentValidationCheck!
    " allocation number validation "
    allocationValidation: DocumentValidationCheck!
  }

  " represent a financial document "
  interface FinancialDocument implements Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
    " aggregated validation info combining all document validations "
    validation: DocumentValidationInfo
  }

  " invoice document "
  type Invoice implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
    validation: DocumentValidationInfo
  }

  " proforma document "
  type Proforma implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
    validation: DocumentValidationInfo
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
    exchangeRateOverride: Float
    description: String
    remarks: String
    validation: DocumentValidationInfo
  }

  " Invoice receipt document - חשבונית מס קבלה "
  type InvoiceReceipt implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
    validation: DocumentValidationInfo
  }

  " Credit invoice document - חשבונית זיכוי "
  type CreditInvoice implements FinancialDocument & Document & Linkable {
    id: UUID!
    image: URL
    file: URL
    vat: FinancialAmount
    documentType: DocumentType
    isReviewed: Boolean
    description: String
    remarks: String

    serialNumber: String
    date: TimelessDate
    amount: FinancialAmount
    vatReportDateOverride: TimelessDate
    noVatAmount: Float
    allocationNumber: String
    exchangeRateOverride: Float
    validation: DocumentValidationInfo
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
    exchangeRateOverride: Float
    description: String
    remarks: String
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
    exchangeRateOverride: Float
    description: String
    remarks: String
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

  extend type ForeignSecuritiesCharge {
    additionalDocuments: [Document!]!
  }

  extend type CreditcardBankCharge {
    additionalDocuments: [Document!]!
  }
`;
