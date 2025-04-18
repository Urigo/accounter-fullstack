import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    salaryRecordsByCharge(chargeId: UUID!): [Salary!]! @auth(role: ACCOUNTANT)
    salaryRecordsByDates(
      fromDate: TimelessDate!
      toDate: TimelessDate!
      employeeIDs: [UUID!]
    ): [Salary!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    insertSalaryRecords(salaryRecords: [SalaryRecordInput!]!): InsertSalaryRecordsResult!
      @auth(role: ADMIN)
    updateSalaryRecord(salaryRecord: SalaryRecordEditInput!): UpdateSalaryRecordResult!
      @auth(role: ADMIN)
    insertOrUpdateSalaryRecords(salaryRecords: [SalaryRecordInput!]!): InsertSalaryRecordsResult!
      @auth(role: ADMIN)
    insertSalaryRecordsFromFile(file: FileScalar!, chargeId: UUID!): Boolean!
      @auth(role: ACCOUNTANT)
  }

  " input variables for insert salary records "
  input SalaryRecordInput {
    addedVacationDays: Float
    baseSalary: Float
    bonus: Float
    chargeId: UUID
    compensationsEmployerAmount: Float
    compensationsEmployerPercentage: Float
    directPaymentAmount: Float!
    employee: String
    employeeId: UUID!
    employer: UUID!
    gift: Float
    globalAdditionalHours: Float
    healthPaymentAmount: Float
    hourlyRate: Float
    hours: Float
    jobPercentage: Float
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
    travelAndSubsistence: Float
    vacationDaysBalance: Float
    vacationTakeout: Float
    workDays: Float
    zkufot: Int
  }

  " input variables for update salary records "
  input SalaryRecordEditInput {
    addedVacationDays: Float
    baseSalary: Float
    bonus: Float
    chargeId: UUID
    compensationsEmployerAmount: Float
    compensationsEmployerPercentage: Float
    directPaymentAmount: Float
    employeeId: UUID!
    employer: UUID
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
    travelAndSubsistence: Float
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
    employees: [LtdFinancialEntity!]!
  }

  " defines salary records for charge arrangement" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type Salary {
    month: String!
    directAmount: FinancialAmount!
    baseAmount: FinancialAmount
    employee: LtdFinancialEntity
    employer: LtdFinancialEntity
    pensionFund: LtdFinancialEntity
    pensionEmployeeAmount: FinancialAmount
    pensionEmployeePercentage: Float
    pensionEmployerAmount: FinancialAmount
    pensionEmployerPercentage: Float
    compensationsAmount: FinancialAmount
    compensationsPercentage: Float
    trainingFund: LtdFinancialEntity
    trainingFundEmployeeAmount: FinancialAmount
    trainingFundEmployeePercentage: Float
    trainingFundEmployerAmount: FinancialAmount
    trainingFundEmployerPercentage: Float
    socialSecurityEmployeeAmount: FinancialAmount
    socialSecurityEmployerAmount: FinancialAmount
    incomeTaxAmount: FinancialAmount
    healthInsuranceAmount: FinancialAmount
    charge: SalaryCharge
    globalAdditionalHoursAmount: FinancialAmount
    bonus: FinancialAmount
    gift: FinancialAmount
    travelAndSubsistence: FinancialAmount
    recovery: FinancialAmount
    notionalExpense: FinancialAmount
    vacationDays: VacationDays
    vacationTakeout: FinancialAmount
    workDays: Float
    sicknessDays: SicknessDays
  }

  " defines vacation days for salary record "
  type VacationDays {
    added: Float
    taken: Float
    balance: Float
  }

  " defines sickness days for salary record "
  type SicknessDays {
    balance: Float
  }
`;
