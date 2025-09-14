import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    pcnFile(
      monthDate: TimelessDate!
      financialEntityId: UUID!
      options: PCNOptionsInput
    ): PCNFileResult! @auth(role: ACCOUNTANT)
    pcnByDate(
      businessId: UUID
      fromMonthDate: TimelessDate!
      toMonthDate: TimelessDate!
    ): [Pcn874Records!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    updatePcn874(businessId: UUID, monthDate: TimelessDate!, content: String!): Boolean!
      @auth(role: ACCOUNTANT)
  }

  " config options for generatePCN "
  input PCNOptionsInput {
    strict: Boolean
  }

  " result type for pcnFile "
  type PCNFileResult {
    reportContent: String!
    fileName: String!
    # rawData: PCNFileRawData
  }

  " record of PCN874 report "
  type Pcn874Records {
    id: ID!
    business: Business!
    date: TimelessDate!
    content: String!
    diffContent: String
  }

  " record type of PCN874 report "
  enum Pcn874RecordType {
    S1
    S2
    L1
    L2
    M
    Y
    I
    T
    K
    R
    P
    H
    C
  }
`;
