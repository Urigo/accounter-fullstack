import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    uniformFormat(fromDate: TimelessDate!, toDate: TimelessDate!): UniformFormat
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " result type for uniformFormat "
  type UniformFormat {
    bkmvdata: FileScalar!
    ini: FileScalar!
  }
`;
