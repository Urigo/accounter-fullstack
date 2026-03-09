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
  }

  " Invitation payload returned after creating an invitation "
  type InvitationPayload {
    id: ID!
    email: String!
    roleId: String!
    expiresAt: DateTime!
  }
`;
