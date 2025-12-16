import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allCountries: [Country!]! @auth(role: ACCOUNTANT)
  }

  " a country "
  type Country {
    id: ID!
    name: String!
    code: CountryCode!
  }
`;
