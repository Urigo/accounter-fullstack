import { graphql } from '../../../graphql.js';

export const AllSortCodesDocument = graphql(`
  query AllSortCodes {
    allSortCodes {
      id
      name
    }
  }
`);
