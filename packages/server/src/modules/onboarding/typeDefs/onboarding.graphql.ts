import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    bootstrapNewClient(input: BootstrapClientInput!): BootstrapClientResult!
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
`;
