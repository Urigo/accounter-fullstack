import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  type TaxCategory {
    id: UUID!
    name: String!
  }
`;
