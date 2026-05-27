import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    bootstrapNewClient(input: BootstrapClientInput!): BootstrapClientResult!
    importShaamFile(ownerId: ID!, bkmvdata: FileScalar!, ini: FileScalar): ImportShaamFileResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " input required to bootstrap a new client business and its initial owner "
  input BootstrapClientInput {
    businessName: String!
    countryCode: String!
    locality: String
    dateEstablished: TimelessDate
    initialAccounterYear: Int
    ownerEmail: String!
    ownerRole: String!
  }

  " Result returned after bootstrapping, including business, invitation token, and admin context. "
  type BootstrapClientResult {
    id: ID!
    business: Business!
    invitationToken: String!
    adminContext: AdminContextInfo!
  }

  " Result of importing a SHAAM uniform-format file pair "
  type ImportShaamFileResult {
    insertedSortCodesCount: Int!
    insertedBusinessesCount: Int!
  }
`;
