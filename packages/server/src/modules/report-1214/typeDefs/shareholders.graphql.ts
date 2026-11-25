import { gql } from 'graphql-modules';

// The `@requiresAnyRole` role lists below must match REPORT_1214_ROLES (helpers/owner.helper.ts),
// which also gates an explicit `ownerId` by the caller's role in that business.
export default gql`
  extend type Query {
    " The owner's shareholders for a tax year (form 1214 records 1020), in report order "
    shareholders(ownerId: UUID, year: Int!): [Shareholder!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  extend type Mutation {
    " Replaces the owner's shareholders for a tax year with the given list, in that order "
    setShareholders(ownerId: UUID, year: Int!, shareholders: [ShareholderInput!]!): [Shareholder!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    " Copies the owner's shareholders of one tax year into another year that has none yet "
    copyShareholdersFromYear(ownerId: UUID, fromYear: Int!, toYear: Int!): [Shareholder!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " A shareholder of the owner company in a tax year (form 1214 record 1020) "
  type Shareholder {
    id: UUID!
    year: Int!
    " Israeli ID or company number, zero-padded to 9 digits; 999999964 / 999999998 are shared placeholders "
    idNumber: String!
    " Full name "
    fullName: String!
    " Whether the shareholder is a controlling shareholder "
    isControllingShareholder: Boolean!
    " Rights to dividends, percent (0-100) "
    dividendRightsPercent: Float
    " Voting rights, percent (0-100) "
    votingRightsPercent: Float
    " Other rights, percent (0-100) "
    otherRightsPercent: Float
    " Whether the shareholder is a material shareholder "
    isMaterialShareholder: Boolean
    " Salary paid in months 1-9 of the year, ILS "
    salaryMonths1To9: Float
    " Salary paid in months 10-12 of the year, ILS "
    salaryMonths10To12: Float
    " Other payments to the shareholder, ILS "
    otherPayments: Float
    " ID of the shareholder's own business in the owner's books, when linked "
    businessId: UUID
    " The shareholder's own business in the owner's books, when linked "
    business: Business
  }

  " A shareholder row to store; the list order is the report order (at most 99 rows) "
  input ShareholderInput {
    " Israeli ID or company number, 1-9 digits (zero-padded to 9 on save); 999999964 (not registered in Israel) and 999999998 (public holding) may repeat "
    idNumber: String!
    " Full name, at most 200 characters (trimmed) "
    fullName: String!
    " Whether the shareholder is a controlling shareholder "
    isControllingShareholder: Boolean!
    " Rights to dividends, percent (0-100, at most 4 decimals) "
    dividendRightsPercent: Float
    " Voting rights, percent (0-100, at most 4 decimals) "
    votingRightsPercent: Float
    " Other rights, percent (0-100, at most 4 decimals) "
    otherRightsPercent: Float
    " Whether the shareholder is a material shareholder "
    isMaterialShareholder: Boolean
    " Salary paid in months 1-9 of the year, ILS "
    salaryMonths1To9: Float
    " Salary paid in months 10-12 of the year, ILS "
    salaryMonths10To12: Float
    " Other payments to the shareholder, ILS "
    otherPayments: Float
    " Optional link to the shareholder's own business, which must belong to the owner "
    businessId: UUID
  }
`;
