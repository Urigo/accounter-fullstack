import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    userContext: UserContext @requiresAuth
  }

  " user context "
  type UserContext {
    adminBusinessId: UUID!
    defaultLocalCurrency: Currency!
    defaultCryptoConversionFiatCurrency: Currency!
    ledgerLock: TimelessDate
    financialAccountsBusinessesIds: [UUID!]!
    locality: String!
    " The role assigned to this user within their workspace (e.g. business_owner, accountant, employee, viewer) "
    roleId: String!
  }
`;
