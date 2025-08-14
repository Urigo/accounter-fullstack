import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    deposit(depositId: String!): BankDeposit!
    depositByCharge(chargeId: UUID!): BankDeposit! @auth(role: ACCOUNTANT)
  }

  " Bank Deposit "
  type BankDeposit {
    id: ID!
    transactions: [Transaction!]!
    balance: FinancialAmount!
    isOpen: Boolean!
  }
`;
