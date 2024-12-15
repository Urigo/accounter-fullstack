import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allCountries: [Country!]! @auth(role: ACCOUNTANT)
  }

  " a country "
  type Country {
    id: ID!
    name: String!
    code: String!
  }
`;
