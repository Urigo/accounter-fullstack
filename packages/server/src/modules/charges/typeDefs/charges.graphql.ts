import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    charge(chargeId: UUID!): Charge! @auth(role: ACCOUNTANT)
    chargesByIDs(chargeIDs: [UUID!]!): [Charge!]! @auth(role: ACCOUNTANT)
    allCharges(filters: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
      @auth(role: ACCOUNTANT)
    chargesWithMissingRequiredInfo(page: Int = 1, limit: Int = 999999): PaginatedCharges!
      @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateCharge(chargeId: UUID!, fields: UpdateChargeInput!): UpdateChargeResult!
      @auth(role: ACCOUNTANT)
    batchUpdateCharges(chargeIds: [UUID!]!, fields: UpdateChargeInput!): BatchUpdateChargesResult!
      @auth(role: ACCOUNTANT)
    mergeCharges(
      baseChargeID: UUID!
      chargeIdsToMerge: [UUID!]!
      fields: UpdateChargeInput
    ): MergeChargeResult! @auth(role: ACCOUNTANT)
    deleteCharge(chargeId: UUID!): Boolean! @auth(role: ACCOUNTANT)
  }

  " represent a complex type for grouped charge with ledger info, bank/card transactions and documents "
  interface Charge {
    id: UUID!
    " calculated field based on the actual ledger records, optional because not all charges has VAT "
    vat: FinancialAmount
    " withholding tax "
    withholdingTax: FinancialAmount
    " the total amount of the charge "
    totalAmount: FinancialAmount
    " פחת, ציוד  "
    property: Boolean
    " is currency conversion "
    conversion: Boolean
    " is salary "
    salary: Boolean
    " is invoice currency different from the payment currency"
    isInvoicePaymentDifferentCurrency: Boolean
    " user custom description "
    userDescription: String
    " minimal event date from linked transactions "
    minEventDate: DateTime
    " minimal debit date from linked transactions "
    minDebitDate: DateTime
    " minimal date from linked documents "
    minDocumentsDate: DateTime
    " metadata about the charge "
    metadata: ChargeMetadata
    " the tax year in which the action took place "
    yearsOfRelevance: [YearOfRelevance!]
    " flag for optional VAT "
    optionalVAT: Boolean
    " flag for optional documents "
    optionalDocuments: Boolean
  }

  " common charge "
  type CommonCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge with conversion transactions "
  type ConversionCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge with conversion transactions "
  type SalaryCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of internal transfer "
  type InternalTransferCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of dividends "
  type DividendCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of dividends "
  type BusinessTripCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of monthly VAT payment "
  type MonthlyVatCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of bank deposits "
  type BankDepositCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of foreign securities "
  type ForeignSecuritiesCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " charge of creditcard over bank account "
  type CreditcardBankCharge implements Charge {
    id: UUID!
    vat: FinancialAmount
    withholdingTax: FinancialAmount
    totalAmount: FinancialAmount
    property: Boolean
    conversion: Boolean
    salary: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    userDescription: String
    minEventDate: DateTime
    minDebitDate: DateTime
    minDocumentsDate: DateTime
    metadata: ChargeMetadata
    yearsOfRelevance: [YearOfRelevance!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " input variables for charge filtering "
  input ChargeFilter {
    " Include only charges with main date occurred after this date "
    fromDate: TimelessDate
    " Include only charges with main date  occurred before this date "
    toDate: TimelessDate
    " Include only charges with any doc/transaction date occurred after this date "
    fromAnyDate: TimelessDate
    " Include only charges with any doc/transaction date occurred before this date "
    toAnyDate: TimelessDate
    " Include only charges related to specific owners financial entities "
    byOwners: [UUID!]
    " Include only charges related to specific financial accounts "
    byFinancialAccounts: [UUID!]
    " Include only charges including specific business "
    byBusinesses: [UUID!]
    " Include only charges with those tags "
    byTags: [String!]
    sortBy: ChargeSortBy
    chargesType: ChargeFilterType
    accountantStatus: [AccountantStatus!]
  }

  " filter charges by type "
  enum ChargeFilterType {
    ALL
    INCOME
    EXPENSE
  }

  " input variables for sorting charges "
  input ChargeSortBy {
    field: ChargeSortByField!
    asc: Boolean
  }

  " fields that can be used to sort charges "
  enum ChargeSortByField {
    DATE
    AMOUNT
    ABS_AMOUNT
  }

  " response for paginated charges "
  type PaginatedCharges {
    nodes: [Charge!]!
    pageInfo: PageInfo!
  }

  " input variables for updateCharge "
  input UpdateChargeInput {
    isConversion: Boolean
    isInvoicePaymentDifferentCurrency: Boolean
    " user custom description "
    userDescription: String
    defaultTaxCategoryID: UUID
    businessTripID: UUID
    yearsOfRelevance: [YearOfRelevanceInput!]
    optionalVAT: Boolean
    optionalDocuments: Boolean
  }

  " input variables for charge spread "
  input YearOfRelevanceInput {
    year: TimelessDate!
    amount: Float
  }

  " result type for updateCharge "
  union UpdateChargeResult = UpdateChargeSuccessfulResult | CommonError

  " result type for batchUpdateCharges "
  union BatchUpdateChargesResult = BatchUpdateChargesSuccessfulResult | CommonError

  " successful result type for updateCharge "
  type UpdateChargeSuccessfulResult {
    charge: Charge!
  }

  " successful result type for batchUpdateCharges "
  type BatchUpdateChargesSuccessfulResult {
    charges: [Charge!]!
  }

  " result type for mergeCharge "
  union MergeChargeResult = MergeChargeSuccessfulResult | CommonError

  " successful result type for mergeCharge "
  type MergeChargeSuccessfulResult {
    charge: Charge!
  }

  " represent charge's metadata"
  type ChargeMetadata {
    " when the initial charge was created from the first event we found "
    createdAt: DateTime!
    " when the charge was last updated "
    updatedAt: DateTime!
    invoicesCount: Int!
    receiptsCount: Int!
    documentsCount: Int!
    openDocuments: Boolean!
    transactionsCount: Int!
    optionalBusinesses: [String!]!
    isSalary: Boolean!
    miscExpensesCount: Int!
    invalidLedger: LedgerValidationStatus!
  }

  " represent charge's metadata ledger validation status "
  enum LedgerValidationStatus {
    VALID
    INVALID
    DIFF
  }

  extend interface Document {
    charge: Charge
  }

  extend interface FinancialDocument {
    charge: Charge
  }

  extend type Proforma {
    charge: Charge
  }

  extend type Receipt {
    charge: Charge
  }

  extend type Invoice {
    charge: Charge
  }

  extend type InvoiceReceipt {
    charge: Charge
  }

  extend type CreditInvoice {
    charge: Charge
  }

  extend type Unprocessed {
    charge: Charge
  }

  extend type OtherDocument {
    charge: Charge
  }

  extend interface FinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type BankFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type CardFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type CryptoWalletFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type ForeignSecuritiesFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type BankDepositFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type LtdFinancialEntity {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  extend type PersonalFinancialEntity {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  extend interface Business {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  " charge spread type "
  type YearOfRelevance {
    year: String!
    amount: Float
  }
`;
