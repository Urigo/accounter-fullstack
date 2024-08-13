import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " business trip expense prototype "
  interface BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    " שולם על ידי העובד "
    payedByEmployee: Boolean
  }

  " represent a business trip accommodation expense "
  type BusinessTripAccommodationExpense implements BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    payedByEmployee: Boolean

    country: String
    nightsCount: Int
    attendeesStay: [BusinessTripAttendeeStay!]!
  }

  " represent a business trip flight expense "
  type BusinessTripFlightExpense implements BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    payedByEmployee: Boolean

    origin: String
    destination: String
    class: String
    attendees: [BusinessTripAttendee!]!
  }

  " represent a business trip travel and subsistence expense "
  type BusinessTripTravelAndSubsistenceExpense implements BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    payedByEmployee: Boolean

    " סוג ההוצאה "
    expenseType: String
  }

  " represent a business trip other expense "
  type BusinessTripOtherExpense implements BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    payedByEmployee: Boolean

    " הוצאה מוכרת "
    deductibleExpense: Boolean
    " פירוט "
    description: String
  }

  " represent a business trip attendee accommodation stay info "
  type BusinessTripAttendeeStay {
    id: UUID!
    attendee: BusinessTripAttendee!
    nightsCount: Int!
  }

  extend type Mutation {
    categorizeBusinessTripExpense(fields: CategorizeBusinessTripExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    categorizeIntoExistingBusinessTripExpense(
      fields: CategorizeIntoExistingBusinessTripExpenseInput!
    ): UUID! @auth(role: ACCOUNTANT)
    uncategorizePartialBusinessTripExpense(
      businessTripExpenseId: UUID!
      transactionId: UUID!
    ): Boolean! @auth(role: ACCOUNTANT)
    updateBusinessTripFlightsExpense(fields: UpdateBusinessTripFlightsExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    updateBusinessTripAccommodationsExpense(
      fields: UpdateBusinessTripAccommodationsExpenseInput!
    ): UUID! @auth(role: ACCOUNTANT)
    updateBusinessTripOtherExpense(fields: UpdateBusinessTripOtherExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    updateBusinessTripTravelAndSubsistenceExpense(
      fields: UpdateBusinessTripTravelAndSubsistenceExpenseInput!
    ): UUID! @auth(role: ACCOUNTANT)
    deleteBusinessTripExpense(businessTripExpenseId: UUID!): Boolean! @auth(role: ACCOUNTANT)

    addBusinessTripFlightsExpense(fields: AddBusinessTripFlightsExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    addBusinessTripAccommodationsExpense(fields: AddBusinessTripAccommodationsExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    addBusinessTripOtherExpense(fields: AddBusinessTripOtherExpenseInput!): UUID!
      @auth(role: ACCOUNTANT)
    addBusinessTripTravelAndSubsistenceExpense(
      fields: AddBusinessTripTravelAndSubsistenceExpenseInput!
    ): UUID! @auth(role: ACCOUNTANT)
  }

  " the input for categorizing a business trip expense "
  input CategorizeBusinessTripExpenseInput {
    businessTripId: UUID!
    transactionId: UUID!
    category: BusinessTripExpenseCategories
    amount: Float
  }

  " represent category type of business trip summary "
  enum BusinessTripExpenseCategories {
    ACCOMMODATION
    FLIGHT
    TRAVEL_AND_SUBSISTENCE
    OTHER
  }

  " the input for categorizing into an existing business trip expense "
  input CategorizeIntoExistingBusinessTripExpenseInput {
    businessTripExpenseId: UUID!
    transactionId: UUID!
    amount: Float
  }

  " the input for updating a business trip flights expense "
  input UpdateBusinessTripFlightsExpenseInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    origin: String
    destination: String
    flightClass: FlightClass
    attendeeIds: [UUID!]
  }

  " represent flight classes "
  enum FlightClass {
    ECONOMY
    PREMIUM_ECONOMY
    BUSINESS
    FIRST_CLASS
  }

  " the input for updating a business trip accommodation expense "
  input UpdateBusinessTripAccommodationsExpenseInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    country: String
    nightsCount: Int
    attendeesStay: [BusinessTripAttendeeStayInput!]!
  }

  " the input for updating a business trip other expense "
  input UpdateBusinessTripOtherExpenseInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    description: String
    deductibleExpense: Boolean
  }

  " the input for updating a business trip T&S expense "
  input UpdateBusinessTripTravelAndSubsistenceExpenseInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    expenseType: String
  }

  " the input for adding a new business trip flights expense "
  input AddBusinessTripFlightsExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    origin: String
    destination: String
    flightClass: FlightClass
    attendeeIds: [UUID!]
  }

  " the input for adding a new business trip accommodation expense "
  input AddBusinessTripAccommodationsExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    country: String
    nightsCount: Int
    attendeesStay: [BusinessTripAttendeeStayInput!]
  }

  " the input for adding a new business trip other expense "
  input AddBusinessTripOtherExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    description: String
    deductibleExpense: Boolean
  }

  " the input for adding a new business trip T&S expense "
  input AddBusinessTripTravelAndSubsistenceExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    expenseType: String
  }

  " the input for attendee accommodation stay info "
  input BusinessTripAttendeeStayInput {
    attendeeId: UUID!
    nightsCount: Int!
  }
`;
