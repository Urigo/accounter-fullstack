import { gql } from 'graphql-modules';

export default gql`
  " Authentication directive: requires user to be authenticated "
  directive @requiresAuth on FIELD_DEFINITION
  " Role-based authorization: requires user to have specific role "
  directive @requiresRole(role: String!) on FIELD_DEFINITION
  " Role-based authorization: requires user to have any of the specified roles "
  directive @requiresAnyRole(roles: [String!]!) on FIELD_DEFINITION
`;
