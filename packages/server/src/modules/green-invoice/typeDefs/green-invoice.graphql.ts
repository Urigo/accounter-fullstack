import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    greenInvoiceBusinesses: [GreenInvoiceBusiness!]! @auth(role: ACCOUNTANT)
  }
  extend type Mutation {
    fetchIncomeDocuments(ownerId: UUID!): [Document!]! @auth(role: ADMIN)
    generateMonthlyClientDocuments(
      issueMonth: TimelessDate
      generateDocumentsInfo: [GenerateDocumentInfo!]!
    ): GenerateMonthlyClientDocumentsResult! @auth(role: ACCOUNTANT)
  }

  " business extended with green invoice data "
  type GreenInvoiceBusiness {
    id: UUID!
    originalBusiness: LtdFinancialEntity!
    greenInvoiceId: UUID!
    remark: String
    emails: [String!]!
    generatedDocumentType: DocumentType!
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
`;
