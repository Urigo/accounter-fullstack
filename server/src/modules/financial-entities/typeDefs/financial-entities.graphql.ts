import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    financialEntity(id: UUID!): FinancialEntity!
    " TODO: This is temporary, should be replaced after auth and financial entities hierarchy is implemented "
    allFinancialEntities(page: Int, limit: Int): PaginatedFinancialEntities
  }

  " response for paginated Financial Entities "
  type PaginatedFinancialEntities {
    nodes: [FinancialEntity!]!
    pageInfo: PageInfo!
  }

  " represent a financial entity of any type, including businesses, tax categories, etc. "
  interface FinancialEntity {
    id: UUID!
    name: String!
  }
`;
