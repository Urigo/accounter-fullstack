import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    chargesByIDs(chargeIDs: [ID!]!): [Charge!]!
    allCharges(filters: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  extend type Mutation {
    updateCharge(chargeId: ID!, fields: UpdateChargeInput!): UpdateChargeResult!
    mergeCharges(
      baseChargeID: ID!
      chargeIdsToMerge: [ID!]!
      fields: UpdateChargeInput
    ): MergeChargeResult!
  }

  " represrent a complex type for grouped charge with ledger info, bank/card transactions and documents "
  type Charge {
    id: ID!
    " when the initial charge was created from the first event we found "
    createdOn: Date!
    " when the charge was last updated "
    updatedOn: Date!
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
    " user custom description "
    userDescription: String
    " minimal event date from linked transactions "
    minEventDate: Date
    " minimal debit date from linked transactions "
    minDebitDate: Date
    " minimal date from linked documents "
    minDocumentsDate: Date
    exchangeRates: ExchangeRates
  }

  " input variables for charge filtering "
  input ChargeFilter {
    " Include only charges occured after this date "
    fromDate: TimelessDate
    " Include only charges occured before this date "
    toDate: TimelessDate
    " Include only charges related to specific owners financial entities "
    byOwners: [ID!]
    " Include only charges related to specific financial accounts "
    byFinancialAccounts: [ID!]
    " Include only charges including specific business "
    byBusinesses: [ID!]
    sortBy: ChargeSortBy
    chargesType: ChargeFilterType
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
    # createdAt: Date!
    # additionalDocument: [Linkable!]!

    # transactions: [Transaction!]!

    # description: String
    # vat: Float
    # withholdingTax: Float
    # totalAmount: FinancialAmountInput
    # eslint-disable-next-line @graphql-eslint/no-hashtag-description -- field for the future
    # invoice: Invoice
    isProperty: Boolean
    isConversion: Boolean
    # businessTrip: BusinessTrip
    " user custom description "
    userDescription: String
  }

  " result type for updateCharge "
  union UpdateChargeResult = Charge | CommonError

  " result type for mergeCharge "
  union MergeChargeResult = Charge | CommonError

  extend interface Document {
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

  extend type Unprocessed {
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

  extend type LtdFinancialEntity {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  extend type PersonalFinancialEntity {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }

  extend interface FinancialEntity {
    charges(filter: ChargeFilter, page: Int = 1, limit: Int = 999999): PaginatedCharges!
  }
`;
