import { gql } from "graphql-modules";

export const businessTripsSchema = gql`extend type Charge {
  " should be later in busines trip module? "
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
  dates: DateRange!
}`
