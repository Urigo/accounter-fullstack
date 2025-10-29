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
    registrationDate: TimelessDate!
    business: LtdFinancialEntity!
    " Tax Advances Info "
    taxAdvancesAnnualIds: [AnnualId!]!
    taxAdvancesRates: [TaxAdvancesRate!]!
    " Withholding Tax Info "
    withholdingTaxCompanyId: String
    withholdingTaxAnnualIds: [AnnualId!]!
    " Social Security Info "
    socialSecurityDeductionsId: String
    socialSecurityEmployerIds: [AnnualId!]!
  }

  " Represents an annual identifier for tax purposes. "
  type AnnualId {
    year: Int!
    id: String!
  }

  " Represents the tax advance rate for a specific date. "
  type TaxAdvancesRate {
    date: TimelessDate!
    rate: Float!
  }

  " Input type for creating a new admin business. "
  input CreateAdminBusinessInput {
    businessId: UUID!
    registrationDate: TimelessDate!
    companyTaxId: String!
    taxAdvancesAnnualId: String
    taxAdvancesRate: Float
    withholdingTaxAnnualId: String
    socialSecurityEmployerId: String
  }

  " Input type for updating admin business details. "
  input UpdateAdminBusinessInput {
    name: String
    governmentId: String
    registrationDate: TimelessDate
    " Tax Advances Info "
    taxAdvancesAnnualIds: [AnnualIdInput!]
    taxAdvancesRates: [TaxAdvancesRateInput!]
    " Withholding Tax Info "
    withholdingTaxCompanyId: String
    withholdingTaxAnnualIds: [AnnualIdInput!]
    " Social Security Info "
    socialSecurityDeductionsId: String
    socialSecurityEmployerIds: [AnnualIdInput!]
  }

  " Input type representing an annual identifier for tax purposes. "
  input AnnualIdInput {
    year: Int!
    id: String!
  }

  " Input type representing the tax advance rate for a specific date. "
  input TaxAdvancesRateInput {
    date: TimelessDate!
    rate: Float!
  }

  extend type LtdFinancialEntity {
    adminInfo: AdminBusiness
  }
`;
