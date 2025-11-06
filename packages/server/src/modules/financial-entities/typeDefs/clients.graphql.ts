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
    emails: [String!]!
    generatedDocumentType: DocumentType!
    integrations: ClientIntegrations!
  }

  " integrations associated with a client "
  type ClientIntegrations {
    id: ID!
    hiveId: String
    linearId: String
    slackChannelKey: String
    notionId: String
    workflowyUrl: String
  }

  " fields for inserting a new client "
  input ClientInsertInput {
    businessId: UUID!
    emails: [String!]
    generatedDocumentType: DocumentType!
    integrations: ClientIntegrationsInput
  }

  " fields for updating an existing client "
  input ClientUpdateInput {
    newBusinessId: UUID
    emails: [String!]
    generatedDocumentType: DocumentType
    integrations: ClientIntegrationsInput
  }

  " integrations input for client insert/update "
  input ClientIntegrationsInput {
    greenInvoiceId: UUID
    hiveId: String
    linearId: String
    slackChannelKey: String
    notionId: String
    workflowyUrl: String
  }

  " result type for updateClient "
  union UpdateClientResponse = Client | CommonError

  extend type LtdFinancialEntity {
    clientInfo: Client
  }
`;
