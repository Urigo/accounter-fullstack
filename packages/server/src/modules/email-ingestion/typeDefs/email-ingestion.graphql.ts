import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    businessEmailConfig(email: String!): BusinessEmailConfig
      @requiresAuth
      @requiresRole(role: "gmail_listener")
  }

  extend type Mutation {
    insertEmailDocuments(
      documents: [FileScalar!]!
      userDescription: String!
      messageId: String
      businessId: UUID
    ): Boolean! @requiresAuth @requiresRole(role: "gmail_listener")
  }

  " configuration for business email processing "
  type BusinessEmailConfig {
    businessId: UUID!
    internalEmailLinks: [String!]
    emailBody: Boolean
    attachments: [EmailAttachmentType!]
  }
`;
