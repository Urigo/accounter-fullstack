import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    transactionsForBalanceReport(
      fromDate: TimelessDate!
      toDate: TimelessDate!
      ownerId: UUID
    ): [BalanceTransactions!]! @auth(role: ACCOUNTANT)
  }

  " transactions for balance report "
  type BalanceTransactions {
    id: UUID!
    chargeId: UUID!
    amount: FinancialAmount!
    date: TimelessDate!
    month: Int!
    year: Int!
    charge: Charge!
    counterparty: FinancialEntity
    isFee: Boolean!
    description: String
  }
`;
