import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    deposit(depositId: String!): BankDeposit! @requiresAuth
    depositByCharge(chargeId: UUID!): BankDeposit @requiresAuth
    allDeposits: [BankDeposit!]! @requiresAuth
  }

  extend type Mutation {
    createDeposit(currency: Currency!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    assignChargeToDeposit(chargeId: UUID!, depositId: String!): BankDeposit!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Bank Deposit "
  type BankDeposit {
    id: ID!
    currency: Currency!
    openDate: TimelessDate!
    closeDate: TimelessDate
    currentBalance: FinancialAmount!
    totalInterest: FinancialAmount!
    totalDeposit: FinancialAmount!
    isOpen: Boolean!
    currencyError: [UUID!]!
    transactions: [Transaction!]!
  }
`;
