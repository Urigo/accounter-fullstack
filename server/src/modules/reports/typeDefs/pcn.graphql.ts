import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    pcnFile(
      fromDate: TimelessDate!
      toDate: TimelessDate!
      financialEntityId: UUID!
      options: PCNOptionsInput
    ): PCNFileResult!
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

  # type PCNFileRawData {
  #   header: PCNHeader!
  #   transactions: [PCNTransaction!]!
  # }

  # type PCNHeader {
  #   licensedDealerId: String!
  #   reportMonth: String!
  #   generationDate: String
  #   taxableSalesAmount: Int!
  #   taxableSalesVat: Int!
  #   salesRecordCount: Int!
  #   zeroValOrExemptSalesCount: Int!
  #   otherInputsVat: Int!
  #   equipmentInputsVat: Int!
  #   inputsCount: Int!
  #   totalVat: Int!
  # }

  # type PCNTransaction {
  #   entryType: PCNEntryType!
  #   vatId: String
  #   invoiceDate: String!
  #   refGroup: String
  #   refNumber: String
  #   totalVat: Int
  #   invoiceSum: Int!
  # }

  # enum PCNEntryType {
  #   S1
  #   S2
  #   L1
  #   L2
  #   M
  #   Y
  #   I
  #   T
  #   K
  #   R
  #   P
  #   H
  #   C
  # }
`;
