import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allBusinessTrips: [BusinessTrip!]! @auth(role: ACCOUNTANT)
    businessTrip(id: UUID!): BusinessTrip @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateChargeBusinessTrip(chargeId: UUID!, businessTripId: UUID): Charge @auth(role: ADMIN)
    insertBusinessTrip(fields: InsertBusinessTripInput!): UUID! @auth(role: ADMIN)
    updateBusinessTrip(fields: BusinessTripUpdateInput!): UUID! @auth(role: ADMIN)
  }

  " the input for creating a business trip "
  input InsertBusinessTripInput {
    name: String!
    fromDate: TimelessDate
    toDate: TimelessDate
    destination: String
    tripPurpose: String
  }

  " the input for updating a business trip "
  input BusinessTripUpdateInput {
    name: String
    destination: String
    tripPurpose: String
  }

  extend interface Charge {
    " should be later in busines trip module? "
    businessTrip: BusinessTrip
  }

  extend type CommonCharge {
    businessTrip: BusinessTrip
  }

  extend type ConversionCharge {
    businessTrip: BusinessTrip
  }

  extend type SalaryCharge {
    businessTrip: BusinessTrip
  }

  extend type InternalTransferCharge {
    businessTrip: BusinessTrip
  }

  extend type DividendCharge {
    businessTrip: BusinessTrip
  }

  extend type BusinessTripCharge {
    businessTrip: BusinessTrip
  }

  extend type MonthlyVatCharge {
    businessTrip: BusinessTrip
  }

  extend type BankDepositCharge {
    businessTrip: BusinessTrip
  }

  extend input ChargeFilter {
    " filter by business trip (should be later in business trip module?) "
    businessTrip: UUID
  }

  " represent a business trip "
  type BusinessTrip {
    id: UUID!
    name: String!
    dates: DateRange
    destination: String
    purpose: String
    attendees: [BusinessTripAttendee!]!
    transactions: [BusinessTripTransaction!]!
    summary: BusinessTripSummary!
  }

  " business trip transaction prototype "
  interface BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    " שולם על ידי העובד "
    payedByEmployee: Boolean
  }

  " represent a business trip uncategorized transaction "
  type BusinessTripUncategorizedTransaction implements BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    payedByEmployee: Boolean
  }

  " represent a business trip accommodation transaction "
  type BusinessTripAccommodationTransaction implements BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    payedByEmployee: Boolean

    country: String
    nightsCount: Int
  }

  " represent a business trip flight transaction "
  type BusinessTripFlightTransaction implements BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    payedByEmployee: Boolean

    origin: String
    destination: String
    class: String
  }

  " represent a business trip travel and subsistence transaction "
  type BusinessTripTravelAndSubsistenceTransaction implements BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    payedByEmployee: Boolean

    " סוג ההוצאה "
    expenseType: String
  }

  " represent a business trip other transaction "
  type BusinessTripOtherTransaction implements BusinessTripTransaction {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transaction: Transaction
    payedByEmployee: Boolean

    " הוצאה מוכרת "
    deductibleExpense: Boolean
    " סוג ההוצאה "
    expenseType: String
  }

  " represent business trip summary data "
  type BusinessTripSummary {
    excessExpenditure: FinancialAmount
    excessTax: Float
    rows: [BusinessTripSummaryRow!]!
  }

  " represent business trip summary data row "
  type BusinessTripSummaryRow {
    type: BusinessTripSummaryCategories!
    totalForeignCurrencies: [FinancialAmount!]!
    totalLocalCurrency: FinancialAmount
    taxableForeignCurrencies: [FinancialAmount!]!
    taxableLocalCurrency: FinancialAmount
    excessExpenditure: FinancialAmount
  }

  " represent category type of business trip summary "
  enum BusinessTripSummaryCategories {
    ACCOMMODATION
    FLIGHT
    TRAVEL_AND_SUBSISTENCE
    OTHER
    TOTAL
  }
`;
