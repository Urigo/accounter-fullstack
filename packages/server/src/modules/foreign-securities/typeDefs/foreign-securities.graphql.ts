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
    " For a sale or a redemption: its capital gain, worked out from the FIFO lots of the account it was made in; lots moved in from another of the owner's accounts keep their cost. Null for any other execution and for a cancelled one "
    capitalGain: SecurityCapitalGainResult
  }

  " The capital gain of a sale or a redemption, from the FIFO lots it disposes of. Local amounts are at the Bank of Israel rates of the trade dates. The real/inflationary split is a company's, with the CPI as the index: for an individual, s.88 makes the exchange rate the index on foreign-currency securities, which is what the bank's figures follow. Commissions are left out: they are booked as fees "
  type SecurityCapitalGain {
    " The disposal's execution id "
    id: ID!
    " Units disposed of "
    quantity: Float!
    " What the units fetched before tax, in the currency they were paid in "
    proceeds: FinancialAmount!
    " The rate of the sale's trade date "
    saleRate: Float!
    " What the units cost, in the currency they were paid in "
    cost: FinancialAmount!
    " Proceeds less cost, in the currency they were paid in "
    originCurrencyGain: FinancialAmount!
    " Local proceeds at the sale rate, less each lot's local cost at its purchase rate "
    nominalGain: FinancialAmount!
    " The part of the nominal gain due to the price: originCurrencyGain at the sale rate "
    priceGain: FinancialAmount!
    " The part of the nominal gain due to the exchange rate: each lot's cost times the rate's change since its purchase "
    exchangeRateGain: FinancialAmount!
    " Income Tax Ordinance s.88, with the CPI as the index (a company's): the exempt part of the nominal gain (סכום אינפלציוני). Never negative, never more than the gain, and nothing on a loss "
    inflationaryAmount: FinancialAmount!
    " s.88: the nominal gain less the inflationary amount (רווח הון ריאלי). A loss is not indexed "
    realGain: FinancialAmount!
    lots: [SecurityCapitalGainLot!]!
  }

  " The units of a disposal drawn from one acquisition, first in, first out "
  type SecurityCapitalGainLot {
    id: ID!
    " The buy (or dividend in kind) the units came from "
    purchaseExecutionId: UUID!
    purchaseDate: TimelessDate!
    quantity: Float!
    " What the units cost, in the currency they were paid in "
    cost: FinancialAmount!
    " The cost at the rate of the purchase date: the original price "
    costLocal: FinancialAmount!
    purchaseRate: Float!
    " The lot's share of the local proceeds: the consideration "
    consideration: FinancialAmount!
    " The month of the CPI known on the purchase date, YYYY-MM "
    purchaseIndexPeriod: String!
    " The month of the CPI known on the sale date, YYYY-MM "
    saleIndexPeriod: String!
    " The CPI known on the sale date over the CPI known on the purchase date "
    indexRatio: Float!
    nominalGain: FinancialAmount!
    inflationaryAmount: FinancialAmount!
    realGain: FinancialAmount!
  }

  " A disposal's capital gain, or why it cannot be worked out "
  union SecurityCapitalGainResult = SecurityCapitalGain | CommonError

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
