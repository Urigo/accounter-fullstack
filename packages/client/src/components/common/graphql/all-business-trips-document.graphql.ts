import { graphql } from '../../../graphql.js';

export const AllBusinessTripsDocument = graphql(`
  query AllBusinessTrips {
    allBusinessTrips {
      id
      name
    }
  }
`);
