import { gql } from 'graphql-modules';

export default gql`
  extend type CreditcardBankCharge {
    creditCardTransactions: [Transaction!]!
    validCreditCardAmount: Boolean!
  }
`;
