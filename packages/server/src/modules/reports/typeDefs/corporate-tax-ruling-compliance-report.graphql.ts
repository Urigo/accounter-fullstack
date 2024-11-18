import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    corporateTaxRulingComplianceReport(years: [Int!]!): [CorporateTaxRulingComplianceReport!]!
      @auth(role: ACCOUNTANT)
  }

  " result type for corporateTaxReport "
  type CorporateTaxRulingComplianceReport {
    id: ID!
    year: Int!
    totalIncome: FinancialAmount!
    researchAndDevelopmentExpenses: FinancialAmount!
    rndRelativeToIncome: CorporateTaxRule!
    localDevelopmentExpenses: FinancialAmount!
    localDevelopmentRelativeToRnd: CorporateTaxRule!
    foreignDevelopmentExpenses: FinancialAmount!
    foreignDevelopmentRelativeToRnd: CorporateTaxRule!
    businessTripRndExpenses: FinancialAmount!
  }

  " Corporate tax rule "
  type CorporateTaxRule {
    id: ID!
    rule: String!
    isCompliant: Boolean!
    percentage: CorporateTaxRulePercentage!
  }

  " Corporate tax rule percentage " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type CorporateTaxRulePercentage {
    value: Float!
    formatted: String!
  }
`;
