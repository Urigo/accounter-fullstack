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

  extend input ChargeFilter {
    " filter by business trip (should be later in busines trip module?) "
    businessTrip: ID
  }

  " represent a business trip "
  type BusinessTrip {
    id: ID!
    name: String!
    dates: DateRange
  }
`;
