import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    employeesByEmployerId(employerId: UUID!): [Employee!]! @auth(role: ACCOUNTANT)
  }

  " represent employee record"
  type Employee {
    id: UUID!
    name: String!
  }
`;
