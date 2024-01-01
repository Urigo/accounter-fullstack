import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allBusinessTrips: [BusinessTrip!]!
    businessTrip(id: ID!): BusinessTrip
  }

  extend type Mutation {
    updateChargeBusinessTrip(chargeId: ID!, businessTripId: ID): Charge
    insertBusinessTrip(fields: InsertBusinessTripInput!): BusinessTrip!
    updateBusinessTrip(fields: BusinessTripUpdateInput!): BusinessTrip!
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
    fromDate: TimelessDate
    toDate: TimelessDate
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

  extend input ChargeFilter {
    " filter by business trip (should be later in business trip module?) "
    businessTrip: ID
  }

  " represent a business trip "
  type BusinessTrip {
    id: ID!
    name: String!
    dates: DateRange
    transactions: [BusinessTripTransaction!]!
  }

  " business trip transaction prototype "
  interface BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    " שולם על ידי העובד "
    payedByEmployee: Boolean
  }

  " represent a business trip uncategorized transaction "
  type BusinessTripUncategorizedTransaction implements BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    payedByEmployee: Boolean
  }

  " represent a business trip accommodation transaction "
  type BusinessTripAccommodationTransaction implements BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    payedByEmployee: Boolean

    country: String
    nightsCount: Int
  }

  " represent a business trip flight transaction "
  type BusinessTripFlightTransaction implements BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    payedByEmployee: Boolean

    origin: String
    destination: String
    class: String
  }

  " represent a business trip travel and subsistence transaction "
  type BusinessTripTravelAndSubsistenceTransaction implements BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    payedByEmployee: Boolean

    " סוג ההוצאה "
    expenseType: String
  }

  " represent a business trip other transaction "
  type BusinessTripOtherTransaction implements BusinessTripTransaction {
    id: ID!
    businessTrip: BusinessTrip!
    date: TimelessDate
    valueDate: TimelessDate
    amount: FinancialAmount
    employee: Counterparty
    transaction: Transaction
    payedByEmployee: Boolean

    " הוצאה מוכרת "
    deductibleExpense: Boolean
    " סוג ההוצאה "
    expenseType: String
  }
`;
