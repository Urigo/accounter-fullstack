import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    updateBusinessTripTransactionCategory(
      fields: UpdateBusinessTripTransactionCategoryInput!
    ): UUID! @auth(role: ADMIN)
  }

  " the input for updating a business trip transaction category "
  input UpdateBusinessTripTransactionCategoryInput {
    businessTripId: UUID!
    transactionId: UUID!
    category: BusinessTripTransactionCategories
  }

  " represent category type of business trip summary "
  enum BusinessTripTransactionCategories {
    ACCOMMODATION
    FLIGHT
    TRAVEL_AND_SUBSISTENCE
    OTHER
  }
`;
