import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    deposit(depositId: String!): BankDeposit! @auth(role: ACCOUNTANT)
    depositByCharge(chargeId: UUID!): BankDeposit! @auth(role: ACCOUNTANT)
    allDeposits: [BankDeposit!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    createDeposit(currency: Currency!): BankDeposit! @auth(role: ACCOUNTANT)
    assignTransactionToDeposit(transactionId: UUID!, depositId: String!): BankDeposit!
      @auth(role: ACCOUNTANT)
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
