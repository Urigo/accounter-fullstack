import { gql } from 'graphql-modules';

export default gql`
  " represent a single bank account"
  type BankFinancialAccount implements FinancialAccount {
    id: UUID!
    name: String!
    type: FinancialAccountType!
    " the external identifier of the bank account "
    accountNumber: String!
    bankNumber: Int!
    branchNumber: Int!
  }

  " input type for creating a bank account "
  input BankAccountInsertInput {
    bankNumber: Int!
    branchNumber: Int!
    extendedBankNumber: Int
    partyPreferredIndication: Int
    partyAccountInvolvementCode: Int
    accountDealDate: Int
    accountUpdateDate: Int
    metegDoarNet: Int
    kodHarshaatPeilut: Int
    accountClosingReasonCode: Int
    accountAgreementOpeningDate: Int
    serviceAuthorizationDesc: Int
    branchTypeCode: Int
    mymailEntitlementSwitch: Int
    productLabel: Int
  }

  " input type for updating a bank account "
  input BankAccountUpdateInput {
    bankNumber: Int
    branchNumber: Int
    extendedBankNumber: Int
    partyPreferredIndication: Int
    partyAccountInvolvementCode: Int
    accountDealDate: Int
    accountUpdateDate: Int
    metegDoarNet: Int
    kodHarshaatPeilut: Int
    accountClosingReasonCode: Int
    accountAgreementOpeningDate: Int
    serviceAuthorizationDesc: Int
    branchTypeCode: Int
    mymailEntitlementSwitch: Int
    productLabel: Int
  }
`;
