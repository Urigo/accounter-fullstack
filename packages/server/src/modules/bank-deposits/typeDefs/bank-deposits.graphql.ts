import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    deposit(id: UUID!): BankDeposit! @requiresAuth
    allDeposits: [BankDeposit!]! @requiresAuth
  }

  extend type Mutation {
    createDeposit(
      name: String!
      currency: Currency!
      openDate: TimelessDate!
      accountId: UUID
    ): BankDeposit! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateDeposit(
      id: UUID!
      name: String
      openDate: TimelessDate
      closeDate: TimelessDate
    ): BankDeposit! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " Bank Deposit "
  type BankDeposit {
    id: ID!
    name: String!
    currency: Currency
    account: FinancialAccount
    openDate: TimelessDate
    closeDate: TimelessDate
    isOpen: Boolean!
  }
`;
