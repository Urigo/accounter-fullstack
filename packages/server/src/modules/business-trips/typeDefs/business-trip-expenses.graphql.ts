import { gql } from 'graphql-modules';

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
    charges: [Charge!]
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
    charges: [Charge!]
    payedByEmployee: Boolean

    country: Country
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
    charges: [Charge!]
    payedByEmployee: Boolean

    path: [String!]
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
    charges: [Charge!]
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
    charges: [Charge!]
    payedByEmployee: Boolean

    " הוצאה מוכרת "
    deductibleExpense: Boolean
    " פירוט "
    description: String
  }

  " represent a business trip car rental expense "
  type BusinessTripCarRentalExpense implements BusinessTripExpense {
    id: UUID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: FinancialEntity
    transactions: [Transaction!]
    charges: [Charge!]
    payedByEmployee: Boolean

    " הוצאה מוכרת "
    days: Int!
    " פירוט "
    isFuelExpense: Boolean!
  }

  " represent a business trip attendee accommodation stay info "
  type BusinessTripAttendeeStay {
    id: UUID!
    attendee: BusinessTripAttendee!
    nightsCount: Int!
  }

  extend type Mutation {
    categorizeBusinessTripExpense(fields: CategorizeBusinessTripExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    categorizeIntoExistingBusinessTripExpense(
      fields: CategorizeIntoExistingBusinessTripExpenseInput!
    ): UUID! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    uncategorizePartialBusinessTripExpense(
      businessTripExpenseId: UUID!
      transactionId: UUID!
    ): Boolean! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripFlightsExpense(fields: UpdateBusinessTripFlightsExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripAccommodationsExpense(
      fields: UpdateBusinessTripAccommodationsExpenseInput!
    ): UUID! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripOtherExpense(fields: UpdateBusinessTripOtherExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripTravelAndSubsistenceExpense(
      fields: UpdateBusinessTripTravelAndSubsistenceExpenseInput!
    ): UUID! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateBusinessTripCarRentalExpense(fields: UpdateBusinessTripCarRentalExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteBusinessTripExpense(businessTripExpenseId: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])

    addBusinessTripFlightsExpense(fields: AddBusinessTripFlightsExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    addBusinessTripAccommodationsExpense(fields: AddBusinessTripAccommodationsExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    addBusinessTripOtherExpense(fields: AddBusinessTripOtherExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    addBusinessTripTravelAndSubsistenceExpense(
      fields: AddBusinessTripTravelAndSubsistenceExpenseInput!
    ): UUID! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
    creditShareholdersBusinessTripTravelAndSubsistence(businessTripId: UUID!): [UUID!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    addBusinessTripCarRentalExpense(fields: AddBusinessTripCarRentalExpenseInput!): UUID!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
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
    CAR_RENTAL
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

    path: [String!]
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

    country: CountryCode
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

  " the input for updating a business trip car rental expense "
  input UpdateBusinessTripCarRentalExpenseInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    days: Int
    isFuelExpense: Boolean
  }

  " the input for adding a new business trip flights expense "
  input AddBusinessTripFlightsExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    path: [String!]
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

    country: CountryCode
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

  " the input for adding a new business trip T&S expense "
  input AddBusinessTripCarRentalExpenseInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    days: Int
    isFuelExpense: Boolean
  }

  " the input for attendee accommodation stay info "
  input BusinessTripAttendeeStayInput {
    attendeeId: UUID!
    nightsCount: Int!
  }
`;
