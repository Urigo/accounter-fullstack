import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    bootstrapNewClient(input: BootstrapClientInput!): BootstrapClientResult!
  }

  input BootstrapClientInput {
    businessName: String!
    countryCode: String!
    locality: String
    dateEstablished: TimelessDate
    initialAccounterYear: Int
    ownerEmail: String!
    ownerRole: String!
  }

  type BootstrapClientResult {
    business: Business!
    invitationToken: String!
    adminContext: AdminContextInfo!
  }
`;
