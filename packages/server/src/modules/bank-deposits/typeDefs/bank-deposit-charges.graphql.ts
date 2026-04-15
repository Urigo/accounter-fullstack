import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    depositByCharge(chargeId: UUID!): BankDeposit @requiresAuth
    relevantDepositsForCharge(chargeId: UUID!): RelevantDepositsResult! @requiresAuth
  }

  " Result of relevantDepositsForCharge: matched open deposits, or an error if the charge has multiple currencies or accounts "
  type RelevantDepositsResult {
    id: ID!
    deposits: [BankDeposit!]!
    " Set when the charge transactions have multiple currencies or multiple accounts "
    error: String
  }

  extend type Mutation {
    assignChargeToDeposit(chargeId: UUID!, depositId: String!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    createDepositFromCharge(chargeId: UUID!, name: String!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Metadata for Bank Deposit, including current balance, total interest, total deposit amount, and associated transactions. "
  type BankDepositMetadata {
    id: ID!
    currentBalance: FinancialAmount!
    totalInterest: FinancialAmount!
    totalDeposit: FinancialAmount!
    potentialCloseDate: TimelessDate
    transactions: [Transaction!]!
  }

  extend type BankDeposit {
    metadata: BankDepositMetadata!
  }
`;
