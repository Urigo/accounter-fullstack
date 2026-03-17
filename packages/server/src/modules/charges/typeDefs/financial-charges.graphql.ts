import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    annualFinancialCharges(ownerId: UUID, year: TimelessDate!): FinancialChargesGenerationResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }
  extend type Mutation {
    generateRevaluationCharge(ownerId: UUID!, date: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateBankDepositsRevaluationCharge(ownerId: UUID!, date: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateTaxExpensesCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateDepreciationCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateRecoveryReserveCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateVacationReserveCharge(ownerId: UUID!, year: TimelessDate!): FinancialCharge!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateBalanceCharge(
      description: String!
      balanceRecords: [InsertMiscExpenseInput!]!
    ): FinancialCharge! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    generateFinancialCharges(
      date: TimelessDate!
      ownerId: UUID!
    ): FinancialChargesGenerationResult!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " financial charge "
  type FinancialCharge implements Charge {
    id: UUID!
    type: ChargeType!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    decreasedVAT: Boolean
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
