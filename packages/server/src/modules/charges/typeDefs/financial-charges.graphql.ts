import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    annualFinancialCharges(ownerId: UUID, year: TimelessDate!): FinancialChargesGenerationResult!
      @auth(role: ACCOUNTANT)
  }
  extend type Mutation {
    generateRevaluationCharge(ownerId: UUID!, date: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateBankDepositsRevaluationCharge(ownerId: UUID!, date: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateTaxExpensesCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateDepreciationCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateRecoveryReserveCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateVacationReserveCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @auth(role: ACCOUNTANT)
    generateBalanceCharge(
      description: String!
      balanceRecords: [InsertMiscExpenseInput!]!
    ): FinancialCharge! @auth(role: ACCOUNTANT)
  }

  " financial charge "
  type FinancialCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " result type for generateFinancialCharges "
  type FinancialChargesGenerationResult {
    id: ID!
    revaluationCharge: FinancialCharge
    taxExpensesCharge: FinancialCharge
    depreciationCharge: FinancialCharge
    recoveryReserveCharge: FinancialCharge
    vacationReserveCharge: FinancialCharge
    bankDepositsRevaluationCharge: FinancialCharge
  }
`;
