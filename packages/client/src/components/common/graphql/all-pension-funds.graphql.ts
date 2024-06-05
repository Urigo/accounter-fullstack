import { graphql } from '../../../graphql.js';

export const AllPensionFundsDocument = graphql(`
  query AllPensionFunds {
    allPensionFunds {
      id
      name
    }
  }
`);
