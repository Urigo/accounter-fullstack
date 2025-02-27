import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.4"
      import: ["@key", "@shareable", "@composeDirective"]
    )
    @link(url: "https://myspecs.dev/myDirective/v2.0", import: ["@auth", "@defer", "@stream"])
    @composeDirective(name: "@auth")
    @composeDirective(name: "@defer")
    @composeDirective(name: "@stream")

  "Authorization directive"
  directive @auth(role: Role!) on FIELD_DEFINITION

  "query root "
  type Query {
    ping: Boolean
  }

  " mutation root "
  type Mutation {
    pong: Boolean
  }

  # Directives

  " Defer directive "
  directive @defer on FRAGMENT_SPREAD | INLINE_FRAGMENT

  " Stream directive "
  directive @stream on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

  " Role based authorization"
  enum Role {
    ADMIN
    ACCOUNTANT
  }

  # Scalars

  " Date "
  scalar DateTime
  " Date with no time of day "
  scalar TimelessDate
  " Rate "
  scalar Rate
  " URL "
  scalar URL
  " File "
  scalar FileScalar
  " UUID "
  scalar UUID

  # Common Types

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

  " Represent financial rounded amount with Int values "
  type FinancialIntAmount {
    " the raw amount, for example: 19 "
    raw: Int!
    " formatted value with the currency symbol, like: 10$ "
    formatted: String!
    " currency of the amount "
    currency: Currency!
  }

  " All possible currencies "
  enum Currency {
    USD
    ILS
    GBP
    EUR
    CAD
    GRT
    USDC
    ETH
  }

  " meta info for page pagination "
  type PageInfo {
    totalPages: Int!
    currentPage: Int
    pageSize: Int
  }
`;
