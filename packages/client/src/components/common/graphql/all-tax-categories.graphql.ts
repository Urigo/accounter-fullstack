import { graphql } from '../../../graphql.js';

export const AllTaxCategoriesDocument = graphql(`
  query AllTaxCategories {
    taxCategories {
      id
      name
    }
  }
`);
