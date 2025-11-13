import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    annualRevenueReport(filters: AnnualRevenueReportFilter!): AnnualRevenueReport!
      @auth(role: ACCOUNTANT)
  }

  " annual revenue report "
  type AnnualRevenueReport {
    id: ID!
    year: Int!
    countries: [AnnualRevenueReportCountry!]!
  }

  " annual revenue report country "
  type AnnualRevenueReportCountry {
    code: String!
    name: String!
    revenue: FinancialAmount!
    clients: [AnnualRevenueReportCountryClient!]!
  }

  " annual revenue report country client "
  type AnnualRevenueReportCountryClient {
    id: UUID!
    name: String!
    revenue: FinancialAmount!
    transactions: [Transaction!]!
  }

  " annual revenue report filter "
  input AnnualRevenueReportFilter {
    year: Int!
    adminBusinessId: UUID
  }
`;
