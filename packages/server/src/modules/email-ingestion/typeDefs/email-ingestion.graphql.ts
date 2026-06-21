import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    businessEmailConfig(email: String!): BusinessEmailConfig
      @requiresAuth
      @requiresRole(role: "gmail_listener")

    " List the email aliases routing incoming mail to a business (defaults to all businesses in scope) "
    emailIngestionAliases(businessId: UUID): [EmailIngestionAlias!]!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    insertEmailDocuments(
      documents: [FileScalar!]!
      userDescription: String!
      messageId: String
      businessId: UUID
    ): Boolean! @requiresAuth @requiresRole(role: "gmail_listener")

    " Provision a new email alias that routes incoming mail to the given business "
    createEmailIngestionAlias(input: CreateEmailIngestionAliasInput!): EmailIngestionAliasResult!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Activate or deactivate an existing email alias owned by a business in scope "
    setEmailIngestionAliasActive(id: UUID!, isActive: Boolean!): EmailIngestionAliasResult!
      @requiresAuth
      @requiresRole(role: "business_owner")

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

  " An alias→business routing entry used to attribute incoming mail to a tenant "
  type EmailIngestionAlias {
    id: UUID!
    " The recipient alias incoming mail is addressed to (matched case-insensitively) "
    alias: String!
    " The business that owns mail delivered to this alias "
    ownerId: UUID!
    " Whether this alias currently routes mail; only one active alias may exist per address "
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  " Input for provisioning a new email alias "
  input CreateEmailIngestionAliasInput {
    " The recipient alias to route from "
    alias: String!
    " The business that should own mail delivered to this alias "
    businessId: UUID!
  }

  " Result of an email alias mutation: the alias or an error "
  union EmailIngestionAliasResult = EmailIngestionAlias | CommonError
`;
