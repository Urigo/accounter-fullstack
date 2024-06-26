import { graphql } from '../../../graphql.js';

export const AllFinancialEntitiesDocument = graphql(`
  query AllFinancialEntities {
    allFinancialEntities {
      nodes {
        id
        name
      }
    }
  }
`);
