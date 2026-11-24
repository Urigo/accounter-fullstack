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

  " depreciation report result; assets in categories that are not depreciated (0%) are left out "
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
    " cost removed by sales and write-offs during the report year "
    reportYearDisposedCost: Int
    " cost removed by cost refunds during the report year "
    reportYearRefundedCost: Int
    " closing cost: originalCost + reportYearDelta - reportYearDisposedCost - reportYearRefundedCost "
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    " accumulated depreciation removed with the parts sold or written off during the report year "
    reportYearDisposedDepreciation: Int
    " accumulated depreciation reversed by the report year's cost refunds: the depreciation correction, booked as ordinary income "
    reportYearDepreciationCorrection: Int
    " closing accumulated depreciation, net of disposals and depreciation corrections "
    totalDepreciation: Int!
    netValue: Int!
    " proceeds of the report year's sales "
    reportYearDisposalProceeds: Int
    " gain (positive) or loss (negative) on the report year's sales and write-offs "
    reportYearDisposalGainLoss: Int
  }

  " Depreciation report summary record "
  type DepreciationReportSummaryRecord implements DepreciationCoreRecord {
    id: ID!
    originalCost: Int
    reportYearDelta: Int
    " cost removed by sales and write-offs during the report year "
    reportYearDisposedCost: Int
    " cost removed by cost refunds during the report year "
    reportYearRefundedCost: Int
    " closing cost: originalCost + reportYearDelta - reportYearDisposedCost - reportYearRefundedCost "
    totalDepreciableCosts: Int!
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    " accumulated depreciation removed with the parts sold or written off during the report year "
    reportYearDisposedDepreciation: Int
    " accumulated depreciation reversed by the report year's cost refunds: the depreciation correction, booked as ordinary income "
    reportYearDepreciationCorrection: Int
    " closing accumulated depreciation, net of disposals and depreciation corrections "
    totalDepreciation: Int!
    netValue: Int!
    " proceeds of the report year's sales "
    reportYearDisposalProceeds: Int
    " gain (positive) or loss (negative) on the report year's sales and write-offs "
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
    reportYearRefundedCost: Int
    totalDepreciableCosts: Int!
    statutoryDepreciationRate: Float!
    claimedDepreciationRate: Float
    reportYearClaimedDepreciation: Int!
    pastYearsAccumulatedDepreciation: Int!
    reportYearDisposedDepreciation: Int
    reportYearDepreciationCorrection: Int
    totalDepreciation: Int!
    netValue: Int!
    reportYearDisposalProceeds: Int
    reportYearDisposalGainLoss: Int
    " date of the sale or write-off that removed the last of the asset's cost, if it is fully disposed of "
    disposalDate: TimelessDate
    " the asset's sales and write-offs during the report year "
    disposals: [DepreciationDisposal!]!
    " the asset's cost refunds during the report year "
    costRefunds: [DepreciationDisposal!]!
  }
`;
