import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addDeelContract(
      contractId: ID!
      contractStartDate: TimelessDate!
      contractorId: UUID!
      contractorName: String!
      businessId: UUID!
    ): Boolean! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    fetchDeelDocuments: [Charge!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }
`;
