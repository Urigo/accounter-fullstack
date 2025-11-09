import { gql } from 'graphql-modules';

export default gql`
  " represent a single bank account"
  type BankFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: String!
    " the external identifier of the bank account "
    accountNumber: String!
    bankNumber: String!
    branchNumber: String!
  }
`;
