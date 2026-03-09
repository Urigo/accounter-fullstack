import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    greenInvoiceClient(clientId: UUID!): GreenInvoiceClient!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    syncGreenInvoiceDocuments(ownerId: UUID!, singlePageLimit: Boolean): [Document!]!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }
  extend type IssuedDocumentInfo {
    originalDocument: DocumentDraft
  }

  extend type ClientIntegrations {
    greenInvoiceInfo: GreenInvoiceClient
  }

  " client info "
  type GreenInvoiceClient {
    country: Country
    emails: [String!]
    greenInvoiceId: ID
    businessId: UUID!
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
`;
