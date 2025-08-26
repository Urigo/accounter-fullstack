import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    adminContext(ownerId: UUID): AdminContext! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateAdminContext(context: AdminContextInput!): AdminContext! @auth(role: ADMIN)
  }

  " input variables for updateTag "
  input AdminContextInput {
    ownerId: UUID!
    name: String
    defaultLocalCurrency: Currency
    defaultForeignCurrency: Currency
    defaultTaxCategoryId: UUID
    vatBusinessId: UUID
    inputVatTaxCategoryId: UUID
    outputVatTaxCategoryId: UUID
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
    isracardBusinessId: UUID
    amexBusinessId: UUID
    calBusinessId: UUID
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
  }

  " defines a tag / category for charge arrangement"
  type AdminContext {
    id: ID!
    ownerId: UUID!
    defaultLocalCurrency: Currency!
    defaultForeignCurrency: Currency!
    defaultTaxCategory: TaxCategory!
    vatBusiness: Business!
    inputVatTaxCategory: TaxCategory!
    outputVatTaxCategory: TaxCategory!
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
    isracardBusiness: Business
    amexBusiness: Business
    calBusiness: Business
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
  }

  extend input UpdateChargeInput {
    tags: [TagInput!]
  }

  " input variables for Tag"
  input TagInput {
    id: String!
  }
`;
