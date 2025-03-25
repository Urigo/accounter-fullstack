import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
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
  }
`;
