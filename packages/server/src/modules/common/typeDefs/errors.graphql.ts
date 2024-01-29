import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  " basic structure of error "
  interface Error {
    message: String!
  }

  " common type of errors"
  type CommonError implements Error {
    message: String!
  }
`;
