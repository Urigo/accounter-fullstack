import { gql } from 'graphql-modules';

export default gql`
  "Supported third-party provider integrations"
  enum ProviderKey {
    "Green Invoice billing platform"
    GREEN_INVOICE
    "Deel global payroll platform"
    DEEL
  }

  "Current credential configuration status for a provider"
  type ProviderCredentialStatus {
    id: ID!
    "The provider key"
    provider: ProviderKey!
    "When the credentials were last updated"
    configuredAt: DateTime!
    "The id of the business entity that represents the provider in the books, if set"
    businessId: UUID
    "The business entity that represents the provider in the books, if set"
    business: Business
  }

  "Result returned after successfully saving provider credentials"
  type ProviderCredentialResult {
    id: ID!
    "The provider key whose credentials were saved"
    provider: ProviderKey!
    "When the credentials were saved"
    configuredAt: DateTime!
    "The business entity that represents the provider in the books, if set"
    businessId: UUID
  }

  "Result returned after successfully deleting provider credentials"
  type ProviderCredentialDeleteResult {
    id: ID!
    "The provider key whose credentials were deleted"
    provider: ProviderKey!
    "Whether the deletion succeeded"
    success: Boolean!
  }

  "Result of a set-credentials mutation — either the saved status or an error"
  union SetProviderCredentialsResult = ProviderCredentialResult | CommonError

  "Result of a delete-credentials mutation — either a confirmation or an error"
  union DeleteProviderCredentialsResult = ProviderCredentialDeleteResult | CommonError

  extend type Query {
    providerCredentials: [ProviderCredentialStatus!]!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    setGreenInvoiceCredentials(id: String!, secret: String!): SetProviderCredentialsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    "Save the Deel API token, and the business representing Deel in the books (kept when omitted)"
    setDeelCredentials(apiToken: String!, businessId: UUID): SetProviderCredentialsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
    "Set the business entity that represents a connected provider in the books; null clears it"
    setProviderBusiness(provider: ProviderKey!, businessId: UUID): SetProviderCredentialsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    deleteProviderCredentials(provider: ProviderKey!): DeleteProviderCredentialsResult!
      @requiresAuth
      @requiresRole(role: "business_owner")
  }
`;
