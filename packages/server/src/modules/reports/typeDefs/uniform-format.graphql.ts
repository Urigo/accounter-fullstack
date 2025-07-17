import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    uniformFormat(fromDate: TimelessDate!, toDate: TimelessDate!): UniformFormat
      @auth(role: ACCOUNTANT)
  }

  " result type for uniformFormat "
  type UniformFormat {
    bkmvdata: FileScalar!
    ini: FileScalar!
  }
`;
