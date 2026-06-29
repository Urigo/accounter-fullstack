import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    businessesUsage(ids: [UUID!]!): [BusinessUsage!]! @requiresAuth
  }

  " usage summary of a business across the system, used to spot unused businesses "
  type BusinessUsage {
    businessId: UUID!
    totalTransactions: Int!
    totalDocuments: Int!
    totalMiscExpenses: Int!
    totalLedgerRecords: Int!
  }
`;
