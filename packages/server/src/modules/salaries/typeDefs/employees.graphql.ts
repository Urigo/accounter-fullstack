import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    employeesByEmployerId(employerId: UUID!): [Employee!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " represent employee record"
  type Employee {
    id: UUID!
    name: String!
  }
`;
