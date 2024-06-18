import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type CreditcardBankCharge {
    creditCardTransactions: [Transaction!]!
    validCreditCardAmount: Boolean!
  }
`;
