import { gql } from 'graphql-modules';

export const ledgerRecordsSchema = gql`
  " represent atomic movement of funds "
  type LedgerRecord {
    id: ID!
    creditAccount: Counterparty
    debitAccount: Counterparty
    originalAmount: FinancialAmount!
    date: TimelessDate!
    description: String!
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmount!
  }

  extend type Charge {
    " ledger records linked to the charge "
    ledgerRecords: [LedgerRecord!]!
  }
`;
