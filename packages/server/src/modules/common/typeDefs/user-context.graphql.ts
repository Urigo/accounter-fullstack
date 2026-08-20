import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    userContext: UserContext @requiresAuth
  }

  " a business the authenticated user belongs to " # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- identified by (user, business); no single id
  type BusinessMembership {
    businessId: UUID!
    role: String!
    businessName: String
  }

  " user context "
  type UserContext {
    " all businesses the user belongs to "
    memberships: [BusinessMembership!]!
    " the businesses this request is authorized to read from "
    activeReadScope: [UUID!]!
    " single-business preference fields are populated only when the active read scope is exactly one business; otherwise null "
    defaultLocalCurrency: Currency
    defaultCryptoConversionFiatCurrency: Currency
    ledgerLock: TimelessDate
    financialAccountsBusinessesIds: [UUID!]
    locality: String
  }
`;
