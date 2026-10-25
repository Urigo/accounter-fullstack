import { gql } from 'graphql-modules';

export default gql`
  extend type ForeignSecuritiesCharge {
    " Securities referenced by this charge's transactions, resolved against the ingested Poalim securities list "
    securities: [ChargeSecurity!]!
    " Main-counterparty candidates, after dropping securities whose trades cancel out within the charge. A single entry is the charge's counterparty; more than one means the charge spans several securities and has no single counterparty "
    counterparties: [FinancialEntity!]!
  }

  " A security key carried by a charge's transaction descriptions, with its reference details when ingested "
  type ChargeSecurity {
    id: ID!
    " Poalim security key, leading zeros stripped "
    securityKey: String!
    " Reference details; null when no matching security was ingested for this owner "
    details: Security
    " The security's own business, reached through the key -> ISIN identifier bridge. Null when the key has no security business yet — the reference feed can be ingested before the executions that create one "
    securityBusiness: SecurityBusiness
    " The charge's transactions whose description carries this key "
    transactions: [Transaction!]!
    " Ingested portfolio executions matched to those transactions by account, date and amount "
    executions: [SecurityExecution!]!
    " Net of the charge's non-fee transactions booked against the security's business. Null when the security has no business, or when those transactions move in more than one currency or are none "
    netAmount: FinancialAmount
    " Whether the security was left out of the charge's counterparties because its trades cancel out within the charge (say, a buy reversed by a sell of the same amount) "
    isOffsetting: Boolean!
  }

  " A single executed action in a Poalim securities portfolio, matched to a charge transaction "
  type SecurityExecution {
    id: UUID!
    " Trade (execution) date "
    tradeDate: TimelessDate!
    valueDate: TimelessDate
    settlementDate: TimelessDate
    " Set for corporate actions such as dividends "
    paymentDate: TimelessDate
    tradeType: SecurityTradeType!
    transactionType: SecurityTransactionType!
    " Set for corporate actions such as dividends "
    paymentType: SecurityPaymentType
    " Nominal value — source field NV. Fractional for ETFs and mutual funds "
    quantity: Float
    " Price per unit, in the trade currency "
    tradePrice: Float
    " Value before commissions and taxes "
    tradeGrossValue: FinancialAmount
    " Net cash effect of the execution, in the trade currency "
    netValue: FinancialAmount
    " The same net effect in ILS, as the bank reports it "
    netValueIls: FinancialAmount
    tradeCommission: FinancialAmount
    managementFees: FinancialAmount
    " Israeli tax, in the trade currency. Source column israe_tax_value — the missing letter is the bank's. The tax withheld from the cash leg, per kind and in the settlement currency, is in the fields below "
    israelTaxValue: FinancialAmount
    " Tax withheld abroad, in the settlement currency; negative for a refund. Source column foreign_tax_value_settlement_currency "
    foreignTaxValue: FinancialAmount
    " Israeli tax withheld on the payment, in the settlement currency; negative for a refund. Source column israel_tax_value_by_payments_settlement_currency "
    israelTaxValueByPayments: FinancialAmount
    " Capital gains tax, in the settlement currency; negative for a refund. Usually restates israelTaxValueByPayments rather than adding to it. Source column capital_tax_value_settlement_currency "
    capitalTaxValue: FinancialAmount
    nominalProfitLoss: FinancialAmount
    realProfitLoss: FinancialAmount
    symbol: String
    isin: String
  }

  " Direction of a securities execution, as the bank files it "
  enum SecurityTradeType {
    BUY
    SELL
    DIVIDEND_PAYMENT
    INTEREST_PAYMENT
    REDEMPTION
    STOCK_DISTRIBUTION
    TRANSFER_IN
    TRANSFER_OUT
    TRANSFER_IN_TWO_SIDED
    TRANSFER_OUT_TWO_SIDED
  }

  " The bucket the bank files an execution under; coarser than SecurityTradeType "
  enum SecurityTransactionType {
    BUY
    SELL
    PAYMENTS_AND_CORPORATE_ACTIONS
    TRANSFERS
  }

  " The corporate action behind a payment execution "
  enum SecurityPaymentType {
    DIVIDEND
    DIVIDEND_IN_KIND
    INTEREST
    REDEMPTION
    EXPIRATION
    SHARE_CONSOLIDATION
    COMPULSORY_TENDER_OFFER
    CONSOLIDATION_OR_CAPITAL_REDUCTION
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
    " The bank's raw flag, as reported. For locality against the tenant use SecurityBusiness.isForeign (null when unknown) "
    isForeign: Boolean! @deprecated(reason: "Use ChargeSecurity.securityBusiness.isForeign")
    " When the reference list was last scraped "
    asOfDate: DateTime!
  }
`;
