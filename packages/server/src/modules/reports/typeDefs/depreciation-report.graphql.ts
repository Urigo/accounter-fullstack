import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    depreciationReport(filters: DepreciationReportFilter): DepreciationReportResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    " cost removed by disposals during the report year "
    reportYearDisposedCost: Int
    " closing cost: originalCost + reportYearDelta - reportYearDisposedCost "
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    " accumulated depreciation removed with the disposed parts during the report year "
    reportYearDisposedDepreciation: Int
    " closing accumulated depreciation, net of disposals "
    totalDepreciation: Int!
    netValue: Int!
    " proceeds of the report year's disposals "
    reportYearDisposalProceeds: Int
    " gain (positive) or loss (negative) on the report year's disposals "
    reportYearDisposalGainLoss: Int
  }

  " Depreciation report summary record "
  type DepreciationReportSummaryRecord implements DepreciationCoreRecord {
    id: ID!
    originalCost: Int
    reportYearDelta: Int
    " cost removed by disposals during the report year "
    reportYearDisposedCost: Int
    " closing cost: originalCost + reportYearDelta - reportYearDisposedCost "
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    " accumulated depreciation removed with the disposed parts during the report year "
    reportYearDisposedDepreciation: Int
    " closing accumulated depreciation, net of disposals "
    totalDepreciation: Int!
    netValue: Int!
    " proceeds of the report year's disposals "
    reportYearDisposalProceeds: Int
    " gain (positive) or loss (negative) on the report year's disposals "
    reportYearDisposalGainLoss: Int
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
    reportYearDisposedCost: Int
    totalDepreciableCosts: Int!
    statutoryDepreciationRate: Float!
    claimedDepreciationRate: Float
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    reportYearDisposedDepreciation: Int
    totalDepreciation: Int!
    netValue: Int!
    reportYearDisposalProceeds: Int
    reportYearDisposalGainLoss: Int
    " date of the disposal that removed the last of the asset's cost, if it is fully disposed of "
    disposalDate: TimelessDate
    " the asset's disposals during the report year "
    disposals: [DepreciationDisposal!]!
  }
`;
