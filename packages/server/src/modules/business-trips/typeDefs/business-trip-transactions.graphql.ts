import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " business trip transaction prototype "
  interface BusinessTripTransaction {
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

  " represent a business trip accommodation transaction "
  type BusinessTripAccommodationTransaction implements BusinessTripTransaction {
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
  }

  " represent a business trip flight transaction "
  type BusinessTripFlightTransaction implements BusinessTripTransaction {
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
  }

  " represent a business trip travel and subsistence transaction "
  type BusinessTripTravelAndSubsistenceTransaction implements BusinessTripTransaction {
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

  " represent a business trip other transaction "
  type BusinessTripOtherTransaction implements BusinessTripTransaction {
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

  extend type Mutation {
    updateBusinessTripTransactionCategory(
      fields: UpdateBusinessTripTransactionCategoryInput!
    ): UUID! @auth(role: ACCOUNTANT)
    updateBusinessTripFlightsTransaction(fields: UpdateBusinessTripFlightsTransactionInput!): UUID!
      @auth(role: ACCOUNTANT)
    updateBusinessTripAccommodationsTransaction(
      fields: UpdateBusinessTripAccommodationsTransactionInput!
    ): UUID! @auth(role: ACCOUNTANT)
    updateBusinessTripOtherTransaction(fields: UpdateBusinessTripOtherTransactionInput!): UUID!
      @auth(role: ACCOUNTANT)
    updateBusinessTripTravelAndSubsistenceTransaction(
      fields: UpdateBusinessTripTravelAndSubsistenceTransactionInput!
    ): UUID! @auth(role: ACCOUNTANT)
    deleteBusinessTripTransaction(businessTripTransactionId: UUID!): Boolean!
      @auth(role: ACCOUNTANT)

    addBusinessTripFlightsTransaction(fields: AddBusinessTripFlightsTransactionInput!): UUID!
      @auth(role: ACCOUNTANT)
    addBusinessTripAccommodationsTransaction(
      fields: AddBusinessTripAccommodationsTransactionInput!
    ): UUID! @auth(role: ACCOUNTANT)
    addBusinessTripOtherTransaction(fields: AddBusinessTripOtherTransactionInput!): UUID!
      @auth(role: ACCOUNTANT)
    addBusinessTripTravelAndSubsistenceTransaction(
      fields: AddBusinessTripTravelAndSubsistenceTransactionInput!
    ): UUID! @auth(role: ACCOUNTANT)
  }

  " the input for updating a business trip transaction category "
  input UpdateBusinessTripTransactionCategoryInput {
    businessTripId: UUID!
    transactionId: UUID!
    category: BusinessTripTransactionCategories
  }

  " represent category type of business trip summary "
  enum BusinessTripTransactionCategories {
    ACCOMMODATION
    FLIGHT
    TRAVEL_AND_SUBSISTENCE
    OTHER
  }

  " the input for updating a business trip flights transaction "
  input UpdateBusinessTripFlightsTransactionInput {
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
  }

  " represent flight classes "
  enum FlightClass {
    ECONOMY
    PREMIUM_ECONOMY
    BUSINESS
    FIRST_CLASS
  }

  " the input for updating a business trip accommodation transaction "
  input UpdateBusinessTripAccommodationsTransactionInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    country: String
    nightsCount: Int
  }

  " the input for updating a business trip other transaction "
  input UpdateBusinessTripOtherTransactionInput {
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

  " the input for updating a business trip T&S transaction "
  input UpdateBusinessTripTravelAndSubsistenceTransactionInput {
    id: UUID!
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    expenseType: String
  }

  " the input for adding a new business trip flights transaction "
  input AddBusinessTripFlightsTransactionInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    origin: String
    destination: String
    flightClass: FlightClass
  }

  " the input for adding a new business trip accommodation transaction "
  input AddBusinessTripAccommodationsTransactionInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    country: String
    nightsCount: Int
  }

  " the input for adding a new business trip other transaction "
  input AddBusinessTripOtherTransactionInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    description: String
    deductibleExpense: Boolean
  }

  " the input for adding a new business trip T&S transaction "
  input AddBusinessTripTravelAndSubsistenceTransactionInput {
    businessTripId: UUID!

    date: TimelessDate
    valueDate: TimelessDate
    amount: Float
    currency: Currency
    employeeBusinessId: UUID

    expenseType: String
  }
`;
