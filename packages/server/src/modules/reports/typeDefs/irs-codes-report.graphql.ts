import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " ledger sums grouped by IRS code, then by financial entity, for ledger records within the period "
    irsCodesReport(fromDate: TimelessDate!, toDate: TimelessDate!): [IrsCodeReportRecord!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " ledger sum of a single IRS code over a period "
  type IrsCodeReportRecord {
    id: ID!
    " null for the misc group (financial entities with no IRS code) "
    irsCode: Int
    label: String
    " sum of credit minus debit local amounts "
    amount: FinancialAmount!
    entities: [ReportCommentarySubRecord!]!
  }
`;
