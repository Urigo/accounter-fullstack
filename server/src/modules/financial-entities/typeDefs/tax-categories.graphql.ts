import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " Tax category entity used for ledger records "
  type TaxCategory {
    id: UUID!
    name: String!
  }
`;
