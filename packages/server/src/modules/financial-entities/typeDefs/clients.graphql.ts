import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    client(businessId: UUID!): Client! @auth(role: ACCOUNTANT)
    allClients: [Client!]! @auth(role: ACCOUNTANT)
  }

  " business extended with green invoice data "
  type Client {
    id: UUID!
    originalBusiness: LtdFinancialEntity!
    greenInvoiceId: UUID!
    emails: [String!]!
    generatedDocumentType: DocumentType!
    greenInvoiceInfo: GreenInvoiceClient!
  }
`;
