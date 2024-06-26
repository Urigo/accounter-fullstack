import { graphql } from '../../../graphql.js';

export const AllTrainingFundsDocument = graphql(`
  query AllTrainingFunds {
    allTrainingFunds {
      id
      name
    }
  }
`);
