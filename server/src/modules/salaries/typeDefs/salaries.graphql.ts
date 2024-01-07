import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    salaryRecordsByCharge(chargeId: UUID!): [Salary!]!
    salaryRecordsByDates(fromDate: TimelessDate!, toDate: TimelessDate!): [Salary!]!
  }

  extend type Mutation {
    insertSalaryRecords(salaryRecords: [SalaryRecordInput!]!): InsertSalaryRecordsResult!
    updateSalaryRecord(salaryRecord: SalaryRecordInput!): UpdateSalaryRecordResult!
    insertOrUpdateSalaryRecords(salaryRecords: [SalaryRecordInput!]!): InsertSalaryRecordsResult!
  }

  " input variables for update/insert salary records "
  input SalaryRecordInput {
    addedVacationDays: Float
    baseSalary: Float
    bonus: Float
    chargeId: UUID
    compensationsEmployerAmount: Float
    compensationsEmployerPercentage: Float
    directPaymentAmount: Float!
    employeeId: UUID!
    employer: UUID!
    gift: Float
    globalAdditionalHours: Float
    healthPaymentAmount: Float
    hourlyRate: Float
    hours: Float
    month: String!
    pensionEmployeeAmount: Float
    pensionEmployeePercentage: Float
    pensionEmployerAmount: Float
    pensionEmployerPercentage: Float
    pensionFundId: UUID
    recovery: Float
    sicknessDaysBalance: Float
    socialSecurityAmountEmployee: Float
    socialSecurityAmountEmployer: Float
    taxAmount: Float
    trainingFundEmployeeAmount: Float
    trainingFundEmployeePercentage: Float
    trainingFundEmployerAmount: Float
    trainingFundEmployerPercentage: Float
    trainingFundId: UUID
    vacationDaysBalance: Float
    vacationTakeout: Float
    workDays: Float
    zkufot: Int
  }

  " result type for insertSalaryRecord "
  union InsertSalaryRecordsResult = InsertSalaryRecordsSuccessfulResult | CommonError

  " result type for insertSalaryRecord" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type InsertSalaryRecordsSuccessfulResult {
    salaryRecords: [Salary!]!
  }

  " result type for updateCharge "
  union UpdateSalaryRecordResult = UpdateSalaryRecordSuccessfulResult | CommonError

  " result type for updateSalaryRecord" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type UpdateSalaryRecordSuccessfulResult {
    salaryRecord: Salary!
  }

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
    charge: SalaryCharge
  }
`;
