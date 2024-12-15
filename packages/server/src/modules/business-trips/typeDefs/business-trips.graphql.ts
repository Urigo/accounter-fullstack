import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allBusinessTrips: [BusinessTrip!]! @auth(role: ACCOUNTANT)
    businessTrip(id: UUID!): BusinessTrip @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updateChargeBusinessTrip(chargeId: UUID!, businessTripId: UUID): Charge @auth(role: ACCOUNTANT)
    insertBusinessTrip(fields: InsertBusinessTripInput!): UUID! @auth(role: ACCOUNTANT)
    updateBusinessTrip(fields: UpdateBusinessTripInput!): UUID! @auth(role: ACCOUNTANT)
  }

  " the input for creating a business trip "
  input InsertBusinessTripInput {
    name: String!
    fromDate: TimelessDate
    toDate: TimelessDate
    destinationCode: String
    tripPurpose: String
  }

  " the input for updating a business trip "
  input UpdateBusinessTripInput {
    name: String
    destinationCode: String
    tripPurpose: String
  }

  extend type BusinessTripCharge {
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
    destination: Country
    purpose: String
    attendees: [BusinessTripAttendee!]!
    flightExpenses: [BusinessTripFlightExpense!]!
    accommodationExpenses: [BusinessTripAccommodationExpense!]!
    travelAndSubsistenceExpenses: [BusinessTripTravelAndSubsistenceExpense!]!
    otherExpenses: [BusinessTripOtherExpense!]!
    carRentalExpenses: [BusinessTripCarRentalExpense!]!
    summary: BusinessTripSummary!
    uncategorizedTransactions: [UncategorizedTransaction]!
  }

  " represent business trip summary data "
  type BusinessTripSummary {
    excessExpenditure: FinancialAmount
    excessTax: Float
    rows: [BusinessTripSummaryRow!]!
    errors: [String!]
  }

  " represent business trip summary data row "
  type BusinessTripSummaryRow {
    type: BusinessTripSummaryCategories!
    totalForeignCurrency: FinancialAmount!
    totalLocalCurrency: FinancialAmount
    taxableForeignCurrency: FinancialAmount!
    taxableLocalCurrency: FinancialAmount
    maxTaxableForeignCurrency: FinancialAmount!
    maxTaxableLocalCurrency: FinancialAmount
    excessExpenditure: FinancialAmount
  }

  " represent category type of business trip summary "
  enum BusinessTripSummaryCategories {
    ACCOMMODATION
    FLIGHT
    TRAVEL_AND_SUBSISTENCE
    CAR_RENTAL
    OTHER
    TOTAL
  }

  " represent transaction not (fully) categorized under business trips "
  type UncategorizedTransaction {
    transaction: Transaction!
    categorizedAmount: FinancialAmount!
    errors: [String!]!
  }
`;
