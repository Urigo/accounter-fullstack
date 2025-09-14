import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    adminBusiness(id: UUID!): AdminBusiness! @auth(role: ACCOUNTANT)
    allAdminBusinesses: [AdminBusiness!]! @auth(role: ACCOUNTANT)
  }

  " Represents a business entity managed by an accountant in the system."
  type AdminBusiness {
    id: UUID!
    name: String!
    governmentId: String!
    business: LtdFinancialEntity!
  }
`;
