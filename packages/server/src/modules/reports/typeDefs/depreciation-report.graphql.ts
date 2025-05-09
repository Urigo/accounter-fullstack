import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    depreciationReport(filters: DepreciationReportFilter): DepreciationReportResult!
      @auth(role: ACCOUNTANT)
  }

  " input variables for depreciationReport "
  input DepreciationReportFilter {
    year: Int!
    financialEntityId: UUID!
  }

  " depreciation report result "
  type DepreciationReportResult {
    categories: [DepreciationReportCategory!]!
    summary: DepreciationReportSummaryRecord!
    year: Int!
  }

  " Depreciation report summary record "
  type DepreciationReportSummaryRecord {
    originalPrice: Int
    reportYearsDelta: Int
    depreciableProperties: Int!
    reportYearsDepreciation: Int!
    accumulatedDepreciation: Int!
    overallDepreciation: Int!
    reducedCost: Int!
  }

  type DepreciationReportCategory {
    category: DepreciationCategory!
    records: [DepreciationReportRecord!]!
    summary: DepreciationReportSummaryRecord!
  }

  " Depreciation report record "
  type DepreciationReportRecord {
    chargeId: UUID!
    description: String!
    purchaseDate: TimelessDate!
    activationDate: TimelessDate
    originalPrice: Int
    reportYearsDelta: Int
    depreciableProperties: Int!
    depreciationRateByLaw: Float!
    depreciationRateClaimed: Float
    reportYearsDepreciation: Int!
    accumulatedDepreciation: Int!
    overallDepreciation: Int!
    reducedCost: Int!
  }
`;
