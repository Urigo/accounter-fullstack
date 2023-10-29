import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
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

  extend input ChargeFilter {
    " filter by business trip (should be later in busines trip module?) "
    businessTrip: ID
  }

  " represent a business trip "
  type BusinessTrip {
    id: ID!
    name: String!
    dates: DateRange!
  }
`;
