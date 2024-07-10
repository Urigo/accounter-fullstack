import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    authoritiesExpensesByCharge(chargeId: UUID!): [AuthoritiesExpense!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateAuthoritiesExpense(
      transactionId: UUID!
      fields: UpdateAuthoritiesExpenseInput!
    ): AuthoritiesExpense! @auth(role: ACCOUNTANT)
    insertAuthoritiesExpense(fields: InsertAuthoritiesExpenseInput!): AuthoritiesExpense!
      @auth(role: ACCOUNTANT)
  }

  " a misc expense for authorities "
  type AuthoritiesExpense {
    transaction: Transaction!
    transactionId: UUID!
    charge: Charge!
    counterparty: FinancialEntity!
    amount: FinancialAmount!
    description: String
    date: TimelessDate
  }

  " input variables for updateAuthoritiesExpense "
  input UpdateAuthoritiesExpenseInput {
    amount: Float
    description: String
    date: TimelessDate
    counterpartyId: UUID
  }

  " input variables for insertAuthoritiesExpense "
  input InsertAuthoritiesExpenseInput {
    transactionId: UUID!
    amount: Float
    description: String
    date: TimelessDate
    counterpartyId: UUID
  }
`;
