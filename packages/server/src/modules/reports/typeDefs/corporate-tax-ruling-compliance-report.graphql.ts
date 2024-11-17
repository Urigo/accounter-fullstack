import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    corporateTaxRulingComplianceReport(years: [Int!]!): [CorporateTaxRulingComplianceReport!]!
      @auth(role: ACCOUNTANT)
  }

  " result type for corporateTaxReport "
  type CorporateTaxRulingComplianceReport {
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

  type CorporateTaxRule {
    rule: String!
    isCompliant: Boolean!
    percentage: CorporateTaxRulePercentage
  }

  type CorporateTaxRulePercentage {
    value: Float!
    formatted: String!
  }
`;
