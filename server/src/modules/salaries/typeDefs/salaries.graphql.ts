import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type SalaryCharge {
    salaryRecords: [Salary!]!
    salaryRecordsSuggestions: [Salary!]!
    employees: [LtdFinancialEntity!]!
  }

  " defines salary records for charge arrangement" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type Salary {
    month: String!
    directAmount: FinancialAmount!
    baseAmount: FinancialAmount
    employee: LtdFinancialEntity
    pensionFund: LtdFinancialEntity
    pensionEmployeeAmount: FinancialAmount
    pensionEmployerAmount: FinancialAmount
    compensationsAmount: FinancialAmount
    trainingFund: LtdFinancialEntity
    trainingFundEmployeeAmount: FinancialAmount
    trainingFundEmployerAmount: FinancialAmount
    socialSecurityEmployeeAmount: FinancialAmount
    socialSecurityEmployerAmount: FinancialAmount
    incomeTaxAmount: FinancialAmount
    healthInsuranceAmount: FinancialAmount
  }
`;
