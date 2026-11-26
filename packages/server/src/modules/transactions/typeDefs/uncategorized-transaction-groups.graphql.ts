import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " transactions with no counterparty, grouped by normalised source description, largest group first "
    uncategorizedTransactionGroups(
      filters: UncategorizedTransactionGroupsFilters
      " how many transaction and charge ids to return per group (1-500) "
      sampleSize: Int = 5
      " groups per page (1-1000) "
      limit: Int = 200
      offset: Int = 0
    ): UncategorizedTransactionGroupsResult! @requiresAuth
  }

  " filters for uncategorizedTransactionGroups "
  input UncategorizedTransactionGroupsFilters {
    " Include only transactions owned by these financial entities (must be within the authorized read scope) "
    byOwners: [UUID!]
    " Include only transactions with event date on or after this date "
    fromEventDate: TimelessDate
    " Include only transactions with event date on or before this date "
    toEventDate: TimelessDate
    " Return only these groups (their keys, as returned in UncategorizedTransactionGroup.key) "
    keys: [String!]
    " Return only groups with at least this many transactions "
    minCount: Int
  }

  " a page of uncategorised transaction groups "
  type UncategorizedTransactionGroupsResult {
    " groups matching the filters, across all pages "
    totalGroups: Int!
    " transactions in those groups, across all pages "
    totalTransactions: Int!
    groups: [UncategorizedTransactionGroup!]!
  }

  " transactions with no counterparty that share a normalised source description "
  type UncategorizedTransactionGroup {
    " the normalised description: lower case, whitespace collapsed, runs of 4+ digits replaced by # "
    key: String!
    " the source description of the group's most recent transaction "
    sampleDescription: String
    transactionCount: Int!
    chargeCount: Int!
    " sum of the group's amounts per currency (signed: negative is money out) "
    totals: [UncategorizedTransactionGroupTotal!]!
    minEventDate: TimelessDate!
    maxEventDate: TimelessDate!
    " up to sampleSize transaction ids, most recent first "
    transactionIds: [UUID!]!
    " up to sampleSize distinct charge ids of those transactions "
    chargeIds: [UUID!]!
  }

  " one currency's sum within an uncategorised transaction group "
  type UncategorizedTransactionGroupTotal {
    currency: Currency!
    amount: Float!
    transactionCount: Int!
  }
`;
