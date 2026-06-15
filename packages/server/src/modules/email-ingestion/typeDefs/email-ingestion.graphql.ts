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
      @requiresRole(role: "gateway_control_plane")

    " Submit a parsed email extraction for v2 ingest (gateway_control_plane only) "
    ingestEmail(input: IngestEmailInput!): IngestEmailResult!
      @requiresAuth
      @requiresRole(role: "gateway_control_plane")
  }

  " Input for requesting a short-lived ingest control grant "
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
    id: UUID!
    jti: String!
    tenantId: String!
    action: String!
    expiresAt: String!
  }

  " Decision record returned when control is granted "
  type IngestControlDecision {
    id: UUID!
    tenantId: String!
    decisionId: String!
    auditId: String!
    grant: IngestGrant!
  }

  " Result of a requestIngestControl mutation: either a decision with a grant or an error "
  union IngestControlResult = IngestControlDecision | CommonError

  " Outcome of a v2 ingest operation "
  enum IngestOutcome {
    INSERTED
    DUPLICATE
    QUARANTINED
    REJECTED
  }

  " Successful (or idempotent) result of an ingestEmail operation "
  type IngestEmailSuccess {
    outcome: IngestOutcome!
    ingestId: UUID
    existingIngestId: UUID
    auditId: String!
    reasonCode: String
  }

  " Result of ingestEmail: outcome or internal error "
  union IngestEmailResult = IngestEmailSuccess | CommonError

  " Input for the v2 ingest endpoint "
  input IngestEmailInput {
    " JTI of the ingest grant from requestIngestControl "
    grantJti: String!
    " Gateway-supplied idempotency key "
    idempotencyKey: String!
    " Tenant ID from the grant (validated server-side) "
    tenantId: String!
    " RFC 2822 Message-ID header "
    messageId: String!
    " SHA-256 hex hash of the raw MIME message "
    rawMessageHash: String!
    " Optional correlation ID for distributed tracing "
    correlationId: String
    " Extracted document metadata from MIME parsing "
    extractedDocuments: [ExtractedDocumentInput!]!
  }

  " Metadata for a single document extracted from the email "
  input ExtractedDocumentInput {
    " SHA-256 hash of the document content "
    hash: String!
    " Document size in bytes "
    sizeBytes: Int!
    " MIME type "
    mimeType: String!
    " Optional filename "
    filename: String
  }

  " configuration for business email processing "
  type BusinessEmailConfig {
    businessId: UUID!
    internalEmailLinks: [String!]
    emailBody: Boolean
    attachments: [EmailAttachmentType!]
  }
`;
