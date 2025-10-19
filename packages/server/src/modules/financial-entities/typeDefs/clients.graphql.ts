import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    client(businessId: UUID!): Client! @auth(role: ACCOUNTANT)
    allClients: [Client!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateClient(businessId: UUID!, fields: ClientUpdateInput!): UpdateClientResponse!
      @auth(role: ACCOUNTANT)
    insertClient(fields: ClientInsertInput!): UpdateClientResponse! @auth(role: ACCOUNTANT)
  }

  " business extended with green invoice data "
  type Client {
    id: UUID!
    originalBusiness: LtdFinancialEntity!
    greenInvoiceId: UUID!
    hiveId: String
    emails: [String!]!
    generatedDocumentType: DocumentType!
    greenInvoiceInfo: GreenInvoiceClient!
  }

  " fields for inserting a new client "
  input ClientInsertInput {
    businessId: UUID!
    greenInvoiceId: UUID!
    hiveId: String
    emails: [String!]
    generatedDocumentType: DocumentType!
  }

  " fields for updating an existing client "
  input ClientUpdateInput {
    greenInvoiceId: UUID
    hiveId: String
    emails: [String!]
    generatedDocumentType: DocumentType
    newBusinessId: UUID
  }

  " result type for updateClient "
  union UpdateClientResponse = Client | CommonError

  extend type LtdFinancialEntity {
    clientInfo: Client
  }
`;
