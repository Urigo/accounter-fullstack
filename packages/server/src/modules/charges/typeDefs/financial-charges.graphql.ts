import { gql } from 'graphql-modules';

export default gql`
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
`;
