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
    id: ID!
    code: String!
    name: String!
    revenueLocal: FinancialAmount!
    revenueDefaultForeign: FinancialAmount!
    clients: [AnnualRevenueReportCountryClient!]!
  }

  " annual revenue report country client "
  type AnnualRevenueReportCountryClient {
    id: ID!
    name: String!
    revenueLocal: FinancialAmount!
    revenueDefaultForeign: FinancialAmount!
    records: [AnnualRevenueReportClientRecord!]!
  }

  " annual revenue report country client record "
  type AnnualRevenueReportClientRecord {
    id: ID!
    chargeId: UUID!
    date: TimelessDate!
    description: String
    reference: String
    revenueLocal: FinancialAmount!
    revenueDefaultForeign: FinancialAmount!
    revenueOriginal: FinancialAmount!
  }

  " annual revenue report filter "
  input AnnualRevenueReportFilter {
    year: Int!
    adminBusinessId: UUID
  }
`;
