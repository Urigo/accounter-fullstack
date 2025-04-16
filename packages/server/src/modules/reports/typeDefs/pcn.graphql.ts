import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
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
    business: Business!
    date: TimelessDate!
    content: String!
    diffContent: String
  }
`;
