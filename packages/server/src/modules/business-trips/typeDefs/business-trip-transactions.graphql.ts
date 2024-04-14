import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    updateBusinessTripTransactionCategory(
      fields: UpdateBusinessTripTransactionCategoryInput!
    ): UUID! @auth(role: ADMIN)
    updateBusinessTripFlightsTransaction(fields: UpdateBusinessTripFlightsTransactionInput!): UUID!
      @auth(role: ADMIN)
    updateBusinessTripAccommodationsTransaction(
      fields: UpdateBusinessTripAccommodationsTransactionInput!
    ): UUID! @auth(role: ADMIN)
    updateBusinessTripOtherTransaction(fields: UpdateBusinessTripOtherTransactionInput!): UUID!
      @auth(role: ADMIN)
    updateBusinessTripTravelAndSubsistenceTransaction(
      fields: UpdateBusinessTripTravelAndSubsistenceTransactionInput!
    ): UUID! @auth(role: ADMIN)
    deleteBusinessTripTransaction(businessTripTransactionId: UUID!): Boolean! @auth(role: ADMIN)

    addBusinessTripFlightsTransaction(fields: AddBusinessTripFlightsTransactionInput!): UUID!
      @auth(role: ADMIN)
    addBusinessTripAccommodationsTransaction(
      fields: AddBusinessTripAccommodationsTransactionInput!
    ): UUID! @auth(role: ADMIN)
    addBusinessTripOtherTransaction(fields: AddBusinessTripOtherTransactionInput!): UUID!
      @auth(role: ADMIN)
    addBusinessTripTravelAndSubsistenceTransaction(
      fields: AddBusinessTripTravelAndSubsistenceTransactionInput!
    ): UUID! @auth(role: ADMIN)
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

    expenseType: String
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

    expenseType: String
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
