import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    " A company's semi-annual report on its securities income (Income Tax Ordinance s.91(d)): sales turnover, capital gains, dividends, interest, the tax on them and the advance due "
    securitiesSemiAnnualReport(
      year: Int!
      half: YearHalf!
      " Capital losses carried forward from prior tax years, as of 1 January of the year, in ILS "
      priorYearsLosses: Float
      " The company to report for; the request's business when omitted "
      businessId: UUID
    ): SecuritiesSemiAnnualReport!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " A half of a tax year "
  enum YearHalf {
    " January to June, reported by 31 July "
    H1
    " July to December, reported by 31 January of the next year "
    H2
  }

  " A kind of income a security pays "
  enum SecuritiesIncomeKind {
    DIVIDEND
    INTEREST
  }

  " Where the issuer of a security resides, relative to the owner "
  enum SecuritiesIncomeLocality {
    LOCAL
    FOREIGN
  }

  " Why the advance is lower than the tax on the half's events, or nothing at all "
  enum SemiAnnualAdvanceNote {
    " Capital losses carried forward absorbed the half's capital gains "
    CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES
    " The half's sales ended in a net capital loss "
    CAPITAL_LOSS_IN_PERIOD
    " The year's capital loss offset the half's dividends and interest (s.92(a)(4)) "
    CAPITAL_LOSS_OFFSET_AGAINST_INCOME
    " The foreign tax withheld covers the Israeli tax on the dividends and interest "
    INCOME_TAX_COVERED_BY_FOREIGN_TAX
    " The Israeli tax withheld at source covers the tax liability "
    LIABILITY_COVERED_BY_WITHHOLDING
    " No sale, dividend or interest in the half "
    NO_TAXABLE_EVENTS
  }

  " A company's semi-annual securities report. Amounts of the declaration are in whole shekels "
  type SecuritiesSemiAnnualReport {
    id: ID!
    " The company the report is for "
    owner: AdminBusiness!
    year: Int!
    half: YearHalf!
    fromDate: TimelessDate!
    toDate: TimelessDate!
    " The day the report and the advance are due "
    dueDate: TimelessDate!
    " The regular corporate tax rate the half is taxed at, as a fraction (0.23); null when none is set "
    taxRate: Float

    " (a) Sales turnover: the consideration of every sale and redemption in the half "
    salesTurnover: FinancialIntAmount!
    " (b) The real capital gains of the sales that ended in a gain "
    totalRealGains: FinancialIntAmount!
    " (c) The capital losses of the sales that ended in a loss, as a positive amount "
    totalLosses: FinancialIntAmount!
    " The half's net real capital gain: gains less losses; negative on a net loss "
    periodNetRealCapitalGain: FinancialIntAmount!
    " The exempt inflationary part of the gains (s.88), for information "
    inflationaryAmount: FinancialIntAmount!
    " Capital losses carried forward from prior years, as given "
    priorYearsLosses: FinancialIntAmount!
    " For the second half: the first half's net real capital gain, which it carries losses from "
    firstHalfNetRealCapitalGain: FinancialIntAmount
    " The carried-forward losses available to this half: prior years', plus the first half's unused loss in the second half "
    lossesCarriedForward: FinancialIntAmount!
    " (d) The net real capital gain after carried-forward losses; negative when losses remain "
    netRealCapitalGain: FinancialIntAmount!

    " Dividend income of the half, local and foreign "
    dividendIncome: FinancialIntAmount!
    " Interest income of the half, local and foreign "
    interestIncome: FinancialIntAmount!
    " The half's dividend and interest income by kind and locality "
    incomeSummary: [SecuritiesIncomeSummary!]!
    " The year's capital loss offset against the half's dividends and interest (s.92(a)(4)) "
    capitalLossOffsetAgainstIncome: FinancialIntAmount!

    " The half's securities expenses: the fees and the financial consultancy the ledger booked "
    securitiesExpenses: FinancialIntAmount!
    " The securities expenses by tax category "
    expenseSummary: [SecuritiesSemiAnnualExpense!]!
    " The part of the expenses deducted from the capital gain "
    expensesDeductedFromGains: FinancialIntAmount!
    " The part of the expenses deducted from the dividends and interest "
    expensesDeductedFromIncome: FinancialIntAmount!
    " Expenses beyond the half's taxable income, left for the annual return "
    unusedExpenses: FinancialIntAmount!
    " The capital gain the tax is on: after carried-forward losses and expenses "
    taxableCapitalGain: FinancialIntAmount!

    " The tax on the net real capital gain (the s.91(d) advance before credits) "
    capitalGainsTax: FinancialIntAmount
    " The tax on taxable dividends (foreign ones: local dividends are exempt for a company) "
    dividendsTax: FinancialIntAmount
    " The tax on interest, local and foreign "
    interestTax: FinancialIntAmount
    " Capital gains tax plus the tax on dividends and interest "
    grossTax: FinancialIntAmount
    " Foreign tax credited, each income bucket capped at the Israeli tax on it "
    foreignTaxCredit: FinancialIntAmount
    " The tax liability from the half's events: gross tax less the foreign tax credit "
    taxLiability: FinancialIntAmount
    " Israeli tax withheld at source on the half's sales "
    israeliTaxWithheldOnSales: FinancialIntAmount!
    " Israeli tax withheld at source on the half's taxable dividends and interest "
    israeliTaxWithheldOnIncome: FinancialIntAmount!
    " Israeli tax withheld at source on exempt income (local dividends): not credited against the advance, but refunded in the annual return "
    israeliTaxWithheldOnExemptIncome: FinancialIntAmount!
    " (e) The advance to pay: the tax liability less the Israeli tax withheld at source, never below zero "
    taxAdvance: FinancialIntAmount
    " Israeli tax withheld beyond the liability, to claim in the annual return "
    excessCredits: FinancialIntAmount
    " Why the advance is lower than the tax, or nothing "
    advanceNotes: [SemiAnnualAdvanceNote!]!

    " The half's sales and redemptions "
    sales: [SecuritiesSemiAnnualSale!]!
    " The half's dividend and interest ledger records "
    incomeItems: [SecuritiesSemiAnnualIncomeItem!]!
    " What the report could not work out, or may have missed "
    issues: [SecuritiesSemiAnnualIssue!]!
  }

  " A sale or redemption of the half "
  type SecuritiesSemiAnnualSale {
    " The execution id "
    id: ID!
    " The security business the execution belongs to, if its Poalim key resolves to one "
    securityBusinessId: UUID
    tradeDate: TimelessDate!
    tradeType: SecurityTradeType!
    " The security, as the bank names it "
    security: String!
    " Units disposed of "
    quantity: Float!
    " The consideration in ILS, at the Bank of Israel rate of the trade date "
    consideration: FinancialAmount!
    " The FIFO cost in ILS, each lot at the rate of its purchase date; null when it cannot be worked out "
    cost: FinancialAmount
    nominalGain: FinancialAmount
    inflationaryAmount: FinancialAmount
    " The real capital gain, or the (nominal) capital loss when negative "
    realGain: FinancialAmount
    " Israeli tax withheld at source on the sale, in ILS "
    israeliTaxWithheld: FinancialAmount!
    " Why the gain could not be worked out "
    error: String
  }

  " The half's dividend and interest income, of one kind and locality "
  type SecuritiesIncomeSummary {
    id: ID!
    kind: SecuritiesIncomeKind!
    locality: SecuritiesIncomeLocality!
    gross: FinancialIntAmount!
    foreignTaxWithheld: FinancialIntAmount!
    israeliTaxWithheld: FinancialIntAmount!
    " Whether a company is taxed on it (local dividends are exempt) "
    taxable: Boolean!
    " The year's capital loss offset against it (s.92(a)(4)) "
    capitalLossOffset: FinancialIntAmount!
    " The securities expenses deducted from it "
    expensesDeducted: FinancialIntAmount!
    tax: FinancialIntAmount
    " The foreign tax credited against its tax, capped at that tax "
    foreignTaxCredit: FinancialIntAmount
  }

  " A dividend or interest ledger record of the half "
  type SecuritiesSemiAnnualIncomeItem {
    " The ledger record id "
    id: ID!
    kind: SecuritiesIncomeKind!
    locality: SecuritiesIncomeLocality!
    chargeId: UUID!
    date: TimelessDate!
    " The security, as the bank names it, when the record's execution is known "
    security: String
    description: String
    " The gross income, in ILS; negative on a reversal "
    gross: FinancialAmount!
    foreignTaxWithheld: FinancialAmount!
    israeliTaxWithheld: FinancialAmount!
  }

  " A securities expense tax category and what the ledger booked on it in the half "
  type SecuritiesSemiAnnualExpense {
    id: ID!
    key: SecuritiesTaxCategoryKey!
    taxCategoryId: UUID!
    name: String!
    amount: FinancialIntAmount!
  }

  " Something the semi-annual report could not work out, or may have missed "
  type SecuritiesSemiAnnualIssue {
    id: ID!
    message: String!
    executionId: UUID
    chargeId: UUID
    " A securities tax category the report needs and the securities settings lack "
    missingTaxCategory: SecuritiesTaxCategoryKey
  }
`;
