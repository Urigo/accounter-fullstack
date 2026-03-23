import { gql } from 'graphql-modules';

// Source connection credentials are NEVER exposed via the API.
// Only metadata (provider, status, account hint) is returned.

export default gql`
  extend type Query {
    workspaceSettings: WorkspaceSettings
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    sourceConnections: [SourceConnection!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    sourceConnection(id: UUID!): SourceConnection
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    dashboardStats: DashboardStats!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Monthly transaction count for a source "
  type MonthlyDataPoint {
    month: String!
    count: Int!
  }

  " Per-source scraping stats shown on the dashboard "
  type SourceSyncStats {
    sourceConnectionId: ID!
    provider: String!
    displayName: String!
    status: String!
    lastSyncAt: DateTime
    lastSyncError: String
    rowCount: Int!
    oldestRecord: String
    newestRecord: String
    monthlyData: [MonthlyDataPoint!]!
  }

  " Financial overview counts for the dashboard "
  type FinancialPulse {
    totalCharges: Int!
    totalTransactions: Int!
    transactionsThisMonth: Int!
    transactionsLastMonth: Int!
    totalDocuments: Int!
  }

  " Aggregated dashboard data "
  type DashboardStats {
    sources: [SourceSyncStats!]!
    financial: FinancialPulse!
    generatedAt: DateTime!
  }

  extend type Mutation {
    updateWorkspaceSettings(input: UpdateWorkspaceSettingsInput!): WorkspaceSettings!
      @requiresAuth
      @requiresRole(role: "business_owner")

    createSourceConnection(input: CreateSourceConnectionInput!): SourceConnection!
      @requiresAuth
      @requiresRole(role: "business_owner")

    updateSourceConnection(id: UUID!, input: UpdateSourceConnectionInput!): SourceConnection!
      @requiresAuth
      @requiresRole(role: "business_owner")

    deleteSourceConnection(id: UUID!): Boolean!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Save encrypted credentials for a source connection. Never returned as plaintext. "
    saveSourceCredentials(id: UUID!, credentialsJson: String!): SourceConnection!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Clear all credentials from a source connection "
    clearSourceCredentials(id: UUID!): SourceConnection!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Upload a workspace logo file server-side and save the resulting URL. Cloudinary secrets are never exposed to the client. "
    uploadWorkspaceLogo(fileBase64: String!, mimeType: String!): WorkspaceSettings!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Remove the workspace logo "
    removeWorkspaceLogo: WorkspaceSettings!
      @requiresAuth
      @requiresRole(role: "business_owner")

    " Trigger a scrape run for a specific source connection (bank or credit card). Runs asynchronously. "
    triggerSourceSync(id: UUID!): SourceSyncResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  type SourceSyncResult {
    success: Boolean!
    message: String!
  }

  " Company profile and branding settings for a workspace "
  type WorkspaceSettings {
    id: ID!
    ownerId: UUID!
    companyName: String
    " Israeli company registration number (מספר ח.פ) "
    companyRegistrationNumber: String
    logoUrl: String
    defaultCurrency: String
    agingThresholdDays: Int
    matchingToleranceAmount: Float
    billingCurrency: String
    billingPaymentTermsDays: Int
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  " Input for updating workspace settings "
  input UpdateWorkspaceSettingsInput {
    companyName: String
    " Israeli company registration number (מספר ח.פ) "
    companyRegistrationNumber: String
    logoUrl: String
    defaultCurrency: String
    agingThresholdDays: Int
    matchingToleranceAmount: Float
    billingCurrency: String
    billingPaymentTermsDays: Int
  }

  " Supported data source providers (banks, credit cards, integrations) "
  enum SourceProvider {
    HAPOALIM
    MIZRAHI
    DISCOUNT
    LEUMI
    ISRACARD
    PRIORITY
    AMEX
    CAL
    MAX
    CLOUDINARY
    GREEN_INVOICE
    GOOGLE_DRIVE
    GMAIL
    DEEL
  }

  " Connection health status "
  enum SourceConnectionStatus {
    ACTIVE
    ERROR
    DISCONNECTED
    PENDING
  }

  " A masked credential field summary - never contains plaintext secrets "
  type MaskedCredentialField {
    id: ID!
    key: String!
    label: String!
    type: String!
    required: Boolean!
    hasValue: Boolean!
    " Masked display value, e.g. 'us****me' or bullet characters "
    maskedValue: String
    placeholder: String
  }

  " An external data source connection with encrypted credentials "
  type SourceConnection {
    id: ID!
    ownerId: UUID!
    provider: SourceProvider!
    displayName: String!
    accountIdentifier: String
    status: SourceConnectionStatus!
    hasCredentials: Boolean!
    " Masked credential field summaries - never contains raw secrets "
    credentialsSummary: [MaskedCredentialField!]!
    lastSyncAt: DateTime
    lastSyncError: String
    financialAccountId: UUID
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  " Input for creating a new source connection "
  input CreateSourceConnectionInput {
    provider: SourceProvider!
    displayName: String!
    accountIdentifier: String
    " JSON string of key-value credential pairs. Stored encrypted, never returned. "
    credentialsJson: String
    financialAccountId: UUID
  }

  " Input for updating an existing source connection "
  input UpdateSourceConnectionInput {
    displayName: String
    accountIdentifier: String
    " JSON string of key-value credential pairs. Stored encrypted, never returned. "
    credentialsJson: String
    status: SourceConnectionStatus
    financialAccountId: UUID
  }
`;
