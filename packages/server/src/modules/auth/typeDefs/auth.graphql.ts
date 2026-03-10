import { gql } from 'graphql-modules';

export default gql`
  " Authentication directive: requires user to be authenticated "
  directive @requiresAuth on FIELD_DEFINITION
  " Role-based authorization: requires user to have specific role "
  directive @requiresRole(role: String!) on FIELD_DEFINITION
  " Role-based authorization: requires user to have any of the specified roles "
  directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION

  extend type Mutation {
    createInvitation(email: String!, roleId: String!): InvitationPayload!
      @requiresRole(role: "business_owner")
    acceptInvitation(token: String!): AcceptInvitationPayload!
    generateApiKey(name: String!, roleId: String!): GenerateApiKeyPayload!
      @requiresRole(role: "business_owner")
  }

  " Invitation payload returned after creating an invitation "
  type InvitationPayload {
    id: ID!
    email: String!
    roleId: String!
    expiresAt: DateTime!
    token: String!
  }

  " Result payload returned after accepting an invitation "
  type AcceptInvitationPayload {
    success: Boolean!
    businessId: ID!
    roleId: String!
  }

  " API key payload returned after generating a new API key "
  type GenerateApiKeyPayload {
    apiKey: String!
    record: ApiKey!
  }

  " API key metadata (plaintext key is never stored) "
  type ApiKey {
    id: ID!
    name: String!
    roleId: String!
    lastUsedAt: DateTime
    createdAt: DateTime!
  }
`;
