import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    businessesUsage(ids: [UUID!]!): [BusinessUsage!]! @requiresAuth
  }

  " usage summary of a business across the system, used to spot unused businesses "
  type BusinessUsage {
    " same value as businessId; present so the type has a unique identifier "
    id: UUID!
    businessId: UUID!
    totalTransactions: Int!
    totalDocuments: Int!
    totalMiscExpenses: Int!
    totalLedgerRecords: Int!
  }
`;
