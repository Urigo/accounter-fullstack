import { gql } from 'graphql-modules';

export default gql`
  extend interface FinancialDocument {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  extend type Invoice {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  extend type Proforma {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  extend type Receipt {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  extend type InvoiceReceipt {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  extend type CreditInvoice {
    issuedDocumentInfo: IssuedDocumentInfo
  }

  " Information about an issued document in the external system "
  type IssuedDocumentInfo {
    id: ID!
    " ID of the issued document in the external system "
    externalId: String!
    " Status of the issued document in the external system "
    status: DocumentStatus!
    linkedDocuments: [FinancialDocument!]
  }

  " Document status "
  enum DocumentStatus {
    OPEN
    CLOSED
    MANUALLY_CLOSED
    CANCELLED_BY_OTHER_DOC
    CANCELLED
  }
`;
