import { graphql } from '../../../graphql.js';

export const AllBusinessesDocument = graphql(`
  query AllBusinesses {
    allBusinesses {
      nodes {
        id
        name
      }
    }
  }
`);
