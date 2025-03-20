import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    addDeelContract(
      contractId: ID!
      contractStartDate: TimelessDate!
      contractorId: UUID!
      contractorName: String!
      businessId: UUID!
    ): Boolean! @auth(role: ACCOUNTANT)
    fetchDeelDocuments: Boolean! @auth(role: ACCOUNTANT)
  }
`;
