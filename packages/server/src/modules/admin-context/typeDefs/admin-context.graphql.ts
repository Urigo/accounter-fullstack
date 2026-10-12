import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    adminContext(ownerId: UUID): AdminContextInfo!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    updateAdminContext(context: AdminContextInput!): AdminContextInfo!
      @requiresAuth
      @requiresRole(role: "business_owner")
    " set or clear the tenant's securities tax categories and sort code "
    updateSecuritiesContext(input: SecuritiesContextInput!): SecuritiesContext!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " the tax categories securities income, withheld tax and redemption gains are booked to "
  enum SecuritiesTaxCategoryKey {
    FOREIGN_DIVIDEND_INCOME
    LOCAL_DIVIDEND_INCOME
    DIVIDEND_WITHHOLDING_TAX
    FOREIGN_BOND_INTEREST_INCOME
    LOCAL_BOND_INTEREST_INCOME
    BOND_WITHHOLDING_TAX
    FOREIGN_SECURITIES_SALE_GAIN
    FOREIGN_SECURITIES_SALE_LOSS
  }

  " the tenant's securities ledger configuration "
  type SecuritiesContext {
    id: ID!
    " the sort code new securities tax categories are created under "
    sortCode: SortCode
    " one entry per key, with a null tax category for an unassigned one "
    taxCategories: [SecuritiesTaxCategoryAssignment!]!
  }

  " a securities tax category key and the tax category assigned to it "
  type SecuritiesTaxCategoryAssignment {
    id: ID!
    key: SecuritiesTaxCategoryKey!
    taxCategory: TaxCategory
  }

  " input variables for updateSecuritiesContext; omitted fields are left as they are "
  input SecuritiesContextInput {
    " null clears the stored sort code "
    sortCode: Int
    taxCategories: [SecuritiesTaxCategoryAssignmentInput!]
  }

  " a tax category to assign to a securities key; a null taxCategoryId unassigns it "
  input SecuritiesTaxCategoryAssignmentInput {
    key: SecuritiesTaxCategoryKey!
    taxCategoryId: UUID
  }

  " input variables for updateAdminContext "
  input AdminContextInput {
    ownerId: UUID!
    defaultLocalCurrency: Currency
    defaultForeignCurrency: Currency
    defaultTaxCategoryId: UUID
    locality: String
    vatBusinessId: UUID
    inputVatTaxCategoryId: UUID
    outputVatTaxCategoryId: UUID
    propertyOutputVatTaxCategoryId: UUID
    taxBusinessId: UUID
    taxExpensesTaxCategoryId: UUID
    socialSecurityBusinessId: UUID
    exchangeRateTaxCategoryId: UUID
    incomeExchangeRateTaxCategoryId: UUID
    exchangeRateRevaluationTaxCategoryId: UUID
    feeTaxCategoryId: UUID
    generalFeeTaxCategoryId: UUID
    fineTaxCategoryId: UUID
    untaxableGiftsTaxCategoryId: UUID
    balanceCancellationTaxCategoryId: UUID
    developmentForeignTaxCategoryId: UUID
    developmentLocalTaxCategoryId: UUID
    accumulatedDepreciationTaxCategoryId: UUID
    rndDepreciationExpensesTaxCategoryId: UUID
    gnmDepreciationExpensesTaxCategoryId: UUID
    marketingDepreciationExpensesTaxCategoryId: UUID
    bankDepositInterestIncomeTaxCategoryId: UUID
    businessTripTaxCategoryId: UUID
    businessTripTagId: UUID
    expensesToPayTaxCategoryId: UUID
    expensesInAdvanceTaxCategoryId: UUID
    incomeToCollectTaxCategoryId: UUID
    incomeInAdvanceTaxCategoryId: UUID
    zkufotExpensesTaxCategoryId: UUID
    zkufotIncomeTaxCategoryId: UUID
    socialSecurityExpensesTaxCategoryId: UUID
    salaryExpensesTaxCategoryId: UUID
    trainingFundExpensesTaxCategoryId: UUID
    pensionFundExpensesTaxCategoryId: UUID
    compensationFundExpensesTaxCategoryId: UUID
    batchedEmployeesBusinessId: UUID
    batchedFundsBusinessId: UUID
    taxDeductionsBusinessId: UUID
    recoveryReserveExpensesTaxCategoryId: UUID
    recoveryReserveTaxCategoryId: UUID
    vacationReserveExpensesTaxCategoryId: UUID
    vacationReserveTaxCategoryId: UUID
    poalimBusinessId: UUID
    discountBusinessId: UUID
    otsarHahayalBusinessId: UUID
    isracardBusinessId: UUID
    amexBusinessId: UUID
    calBusinessId: UUID
    otsarHahayalCreditCardBusinessId: UUID
    etanaBusinessId: UUID
    krakenBusinessId: UUID
    etherscanBusinessId: UUID
    swiftBusinessId: UUID
    bankDepositBusinessId: UUID
    dividendWithholdingTaxBusinessId: UUID
    dividendTaxCategoryId: UUID
    salaryExcessExpensesTaxCategoryId: UUID
    ledgerLock: TimelessDate
    foreignSecuritiesBusinessId: UUID
    foreignSecuritiesFeesCategoryId: UUID
    dateEstablished: TimelessDate
    initialAccounterYear: Int
  }

  " defines a tag / category for charge arrangement"
  type AdminContextInfo {
    id: ID!
    ownerId: UUID!
    defaultLocalCurrency: Currency!
    defaultForeignCurrency: Currency!
    defaultTaxCategory: TaxCategory!
    locality: String!
    vatBusiness: Business!
    inputVatTaxCategory: TaxCategory!
    outputVatTaxCategory: TaxCategory!
    propertyOutputVatTaxCategory: TaxCategory
    taxBusiness: Business!
    taxExpensesTaxCategory: TaxCategory!
    socialSecurityBusiness: Business!
    exchangeRateTaxCategory: TaxCategory!
    incomeExchangeRateTaxCategory: TaxCategory!
    exchangeRateRevaluationTaxCategory: TaxCategory!
    feeTaxCategory: TaxCategory!
    generalFeeTaxCategory: TaxCategory!
    fineTaxCategory: TaxCategory!
    untaxableGiftsTaxCategory: TaxCategory!
    balanceCancellationTaxCategory: TaxCategory!
    developmentForeignTaxCategory: TaxCategory!
    developmentLocalTaxCategory: TaxCategory!
    accumulatedDepreciationTaxCategory: TaxCategory
    rndDepreciationExpensesTaxCategory: TaxCategory
    gnmDepreciationExpensesTaxCategory: TaxCategory
    marketingDepreciationExpensesTaxCategory: TaxCategory
    bankDepositInterestIncomeTaxCategory: TaxCategory
    businessTripTaxCategory: TaxCategory
    businessTripTag: Tag
    expensesToPayTaxCategory: TaxCategory!
    expensesInAdvanceTaxCategory: TaxCategory!
    incomeToCollectTaxCategory: TaxCategory!
    incomeInAdvanceTaxCategory: TaxCategory
    zkufotExpensesTaxCategory: TaxCategory
    zkufotIncomeTaxCategory: TaxCategory
    socialSecurityExpensesTaxCategory: TaxCategory
    salaryExpensesTaxCategory: TaxCategory
    trainingFundExpensesTaxCategory: TaxCategory
    pensionFundExpensesTaxCategory: TaxCategory
    compensationFundExpensesTaxCategory: TaxCategory
    batchedEmployeesBusiness: Business
    batchedFundsBusiness: Business
    taxDeductionsBusiness: Business
    recoveryReserveExpensesTaxCategory: TaxCategory
    recoveryReserveTaxCategory: TaxCategory
    vacationReserveExpensesTaxCategory: TaxCategory
    vacationReserveTaxCategory: TaxCategory
    poalimBusiness: Business
    discountBusiness: Business
    otsarHahayalBusiness: Business
    isracardBusiness: Business
    amexBusiness: Business
    calBusiness: Business
    otsarHahayalCreditCardBusiness: Business
    etanaBusiness: Business
    krakenBusiness: Business
    etherscanBusiness: Business
    swiftBusiness: Business
    bankDepositBusiness: Business
    dividendWithholdingTaxBusiness: Business
    dividendTaxCategory: TaxCategory
    salaryExcessExpensesTaxCategory: TaxCategory!
    ledgerLock: TimelessDate
    foreignSecuritiesBusiness: Business
    foreignSecuritiesFeesCategory: TaxCategory
    securitiesContext: SecuritiesContext!
    dateEstablished: TimelessDate
    initialAccounterYear: Int
  }
`;
