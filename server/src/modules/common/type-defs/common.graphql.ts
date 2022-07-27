import { gql } from 'graphql-modules';

export const commonSchema = gql`
  # Scalars

  " Date "
  scalar Date
  " Date with no time of day "
  scalar TimelessDate
  " IBAN "
  scalar IBAN
  " Percentage"
  scalar Percentage
  " Rate "
  scalar Rate
  " URL "
  scalar URL

  " a date range "
  type DateRange {
    start: TimelessDate!
    end: TimelessDate!
  }

  " Represent financial amount "
  type FinancialAmount {
    " the raw amount, for example: 19.99 "
    raw: Float!
    " formatted value with the currency symbol, like: 10$ "
    formatted: String!
    " currency of the amount "
    currency: Currency!
  }

  " input variables for updateCharge.FinancialAmount"
  input FinancialAmountInput {
    raw: Float!
    currency: Currency!
  }

  " All possible currencies "
  enum Currency {
    USD
    ILS
    GBP
    EUR
  }

  " query root "
  type Query {
    node(id: ID!): Node
  }

  " mutation root "
  type Mutation {
    ping: Boolean
  }

  " node interface "
  interface Node {
    id: ID!
  }
`;
