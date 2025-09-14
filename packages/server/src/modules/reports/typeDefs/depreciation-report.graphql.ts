import { gql } from 'graphql-modules';

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

  " Depreciation report category group "
  type DepreciationReportCategory {
    id: ID!
    category: DepreciationCategory!
    records: [DepreciationReportRecord!]!
    summary: DepreciationReportSummaryRecord!
  }

  " Depreciation report record core fields "
  interface DepreciationCoreRecord {
    id: ID!
    originalCost: Int
    reportYearDelta: Int
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    totalDepreciation: Int!
    netValue: Int!
  }

  " Depreciation report summary record "
  type DepreciationReportSummaryRecord implements DepreciationCoreRecord {
    id: ID!
    originalCost: Int
    reportYearDelta: Int
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    totalDepreciation: Int!
    netValue: Int!
  }

  " Depreciation report record "
  type DepreciationReportRecord implements DepreciationCoreRecord {
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
