import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    adminBusiness(id: UUID!): AdminBusiness! @auth(role: ACCOUNTANT)
    allAdminBusinesses: [AdminBusiness!]! @auth(role: ACCOUNTANT)
  }
  extend type Mutation {
    createAdminBusiness(input: CreateAdminBusinessInput!): AdminBusiness! @auth(role: ADMIN)

    updateAdminBusiness(businessId: UUID!, fields: UpdateAdminBusinessInput!): AdminBusiness!
      @auth(role: ADMIN)

    deleteAdminBusiness(businessId: UUID!): Boolean! @auth(role: ADMIN)
  }

  " Represents a business entity managed by an accountant in the system."
  type AdminBusiness {
    id: UUID!
    name: String!
    governmentId: String!
    business: LtdFinancialEntity!
    withholdingTaxBookNumber: String
    withholdingTaxFileNumber: String
    socialSecurityEmployerId: String
    taxAdvancesRate: Float
    taxAdvancesId: String
    registrationDate: TimelessDate!
  }

  " Input type for creating a new admin business. "
  input CreateAdminBusinessInput {
    businessId: UUID!
    withholdingTaxBookNumber: String
    withholdingTaxFileNumber: String
    socialSecurityEmployerId: String
    taxAdvancesRate: Float
    taxAdvancesId: String
    registrationDate: TimelessDate!
  }

  " Input type for updating admin business details. "
  input UpdateAdminBusinessInput {
    withholdingTaxBookNumber: String
    withholdingTaxFileNumber: String
    socialSecurityEmployerId: String
    taxAdvancesRate: Float
    taxAdvancesId: String
    registrationDate: TimelessDate
  }

  extend type LtdFinancialEntity {
    adminInfo: AdminBusiness
  }
`;
