import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    userContext: UserContext @auth(role: ACCOUNTANT)
  }

  " user context "
  type UserContext {
    adminBusinessId: UUID!
    defaultLocalCurrency: Currency!
    defaultCryptoConversionFiatCurrency: Currency!
    ledgerLock: TimelessDate
    financialAccountsBusinessesIds: [UUID!]!
    locality: String!
  }
`;
