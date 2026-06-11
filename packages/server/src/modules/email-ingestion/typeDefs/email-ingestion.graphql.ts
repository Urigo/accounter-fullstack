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

    " Request a short-lived ingest control grant for a verified incoming message "
    requestIngestControl(input: IngestControlInput!): IngestControlResult!
      @requiresAuth
      @requiresRole(role: "gmail_listener")
  }

  input IngestControlInput {
    " Recipient alias the message was delivered to "
    recipientAlias: String!
    " RFC 2822 Message-ID header "
    messageId: String!
    " SHA-256 hex hash of the raw MIME message "
    rawMessageHash: String!
    " ISO-8601 timestamp the message was received (reserved for future replay-window validation) "
    receivedAt: String
    " Optional correlation ID for distributed tracing "
    correlationId: String
  }

  " Short-lived single-use ingest grant "
  type IngestGrant {
    jti: String!
    tenantId: String!
    action: String!
    expiresAt: String!
  }

  " Decision record returned when control is granted "
  type IngestControlDecision {
    tenantId: String!
    decisionId: String!
    auditId: String!
    grant: IngestGrant!
  }

  union IngestControlResult = IngestControlDecision | CommonError

  " configuration for business email processing "
  type BusinessEmailConfig {
    businessId: UUID!
    internalEmailLinks: [String!]
    emailBody: Boolean
    attachments: [EmailAttachmentType!]
  }
`;
