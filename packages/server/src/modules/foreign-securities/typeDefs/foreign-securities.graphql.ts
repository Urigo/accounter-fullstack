import { gql } from 'graphql-modules';

export default gql`
  extend type ForeignSecuritiesCharge {
    " Securities referenced by this charge's transactions, resolved against the ingested Poalim securities list "
    securities: [ChargeSecurity!]!
  }

  " A security key carried by a charge's transaction descriptions, with its reference details when ingested "
  type ChargeSecurity {
    id: ID!
    " Poalim security key, leading zeros stripped "
    securityKey: String!
    " Reference details; null when no matching security was ingested for this owner "
    details: Security
    " The charge's transactions whose description carries this key "
    transactions: [Transaction!]!
    " Ingested portfolio executions matched to those transactions by account, date and amount "
    executions: [SecurityExecution!]!
  }

  " A single executed action in a Poalim securities portfolio, matched to a charge transaction. Numeric values are strings: the source columns are Postgres numeric, and a Float would lose precision on quantities and prices "
  type SecurityExecution {
    id: UUID!
    " Trade (execution) date "
    tradeDate: DateTime!
    valueDate: DateTime
    settlementDate: DateTime
    " Set for corporate actions such as dividends "
    paymentDate: DateTime
    " Direction, as reported by the bank "
    tradeType: String!
    transactionType: String!
    " Quantity — source field NV "
    quantity: String
    tradePrice: String
    tradeGrossValueTradeCurrency: String
    netValueTradeCurrency: String
    netValueSettlementCurrency: String
    netValueNis: String
    " Kept as free strings, not the Currency enum, for source fidelity "
    tradeCurrency: String
    settlementCurrency: String
    tradeCommissionValueTradeCurrency: String
    managementFeesValueTradeCurrency: String
    " Source column israe_tax_value — the missing letter is the bank's "
    israelTaxValue: String
    nominalProfitLossNis: String
    realProfitLossNis: String
    paymentType: String
    symbol: String
    isin: String
    orderType: String
  }

  " Static reference details of a security held in a Poalim trading account "
  type Security {
    id: UUID!
    " Poalim security key, as reported by the bank (unpadded) "
    key: String!
    engName: String!
    hebName: String!
    symbol: String
    engSymbol: String
    hebSymbol: String
    itemType: String!
    stockType: String
    " Empty string in the source is normalized to null "
    exchange: String
    " Kept as a free string, not the Currency enum, for source fidelity "
    currencyCode: String!
    isEtf: Boolean
    isForeign: Boolean!
    " When the reference list was last scraped "
    asOfDate: DateTime!
  }
`;
