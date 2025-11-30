import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addDeelContract(
      contractId: ID!
      contractStartDate: TimelessDate!
      contractorId: UUID!
      contractorName: String!
      businessId: UUID!
    ): Boolean! @auth(role: ACCOUNTANT)
    fetchDeelDocuments: [Charge!]! @auth(role: ACCOUNTANT)
  }
`;
