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
    financialEntityId: UUID
  }

  " depreciation report result "
  type DepreciationReportResult {
    id: ID!
    categories: [DepreciationReportCategory!]!
    summary: DepreciationReportSummaryRecord!
    year: Int!
  }

  " Depreciation report summary record "
  type DepreciationReportSummaryRecord {
    id: ID!
    originalCost: Int
    reportYearDelta: Int
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    totalDepreciation: Int!
    netValue: Int!
  }

  " Depreciation report category group "
  type DepreciationReportCategory {
    id: ID!
    category: DepreciationCategory!
    records: [DepreciationReportRecord!]!
    summary: DepreciationReportSummaryRecord!
  }

  " Depreciation report record "
  type DepreciationReportRecord {
    id: ID!
    chargeId: UUID!
    description: String
    purchaseDate: TimelessDate!
    activationDate: TimelessDate
    originalCost: Int
    reportYearDelta: Int
    totalDepreciableCosts: Int!
    statutoryDepreciationRate: Float!
    claimedDepreciationRate: Float
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    totalDepreciation: Int!
    netValue: Int!
  }
`;
