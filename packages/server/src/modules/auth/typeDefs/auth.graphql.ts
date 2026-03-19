import { gql } from 'graphql-modules';

export default gql`
  " Authentication directive: requires user to be authenticated "
  directive @requiresAuth on FIELD_DEFINITION
  " Role-based authorization: requires user to have specific role "
  directive @requiresRole(role: String!) on FIELD_DEFINITION
  " Role-based authorization: requires user to have any of the specified roles "
  directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION

  extend type Query {
    listApiKeys: [ApiKey!]! @requiresRole(role: "business_owner")
    " List all members of the current workspace "
    listTeamMembers: [TeamMember!]! @requiresAuth
    " List pending (not yet accepted) invitations for the current workspace "
    listPendingInvitations: [PendingInvitation!]! @requiresRole(role: "business_owner")
  }

  extend type Mutation {
    createInvitation(email: String!, roleId: String!): InvitationPayload!
      @requiresRole(role: "business_owner")
    acceptInvitation(token: String!): AcceptInvitationPayload!
    " Remove a team member from the workspace "
    removeTeamMember(userId: ID!): Boolean! @requiresRole(role: "business_owner")
    " Revoke a pending invitation "
    revokeInvitation(invitationId: ID!): Boolean! @requiresRole(role: "business_owner")
    " Change a team member's role "
    updateTeamMemberRole(userId: ID!, roleId: String!): TeamMember!
      @requiresRole(role: "business_owner")
    generateApiKey(name: String!, roleId: String!): GenerateApiKeyPayload!
      @requiresRole(role: "business_owner")
    revokeApiKey(id: ID!): Boolean! @requiresRole(role: "business_owner")
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

  " A member of the current workspace "
  type TeamMember {
    id: ID!
    userId: ID!
    email: String
    roleId: String!
    " Human-readable display label for the role "
    roleLabel: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  " A pending (not yet accepted) invitation "
  type PendingInvitation {
    id: ID!
    email: String!
    roleId: String!
    roleLabel: String!
    expiresAt: DateTime!
    createdAt: DateTime!
  }
`;
