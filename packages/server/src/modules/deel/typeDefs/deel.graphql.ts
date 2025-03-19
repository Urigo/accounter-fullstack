import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Mutation {
    addDeelEmployee(businessId: UUID!, deelId: ID!): Boolean! @auth(role: ACCOUNTANT)
    addDeelPaymentInfo(records: [DeelDocumentRecord!]!): Boolean! @auth(role: ACCOUNTANT)
    fetchDeelDocuments: Boolean! @auth(role: ACCOUNTANT)
  }

  " Deel document record input "
  input DeelDocumentRecord {
    amount: Float!
    amountInvoiceCurrency: Currency!
    contractId: String
    contractOrFeeDescription: String
    currency: Currency!
    deelInvoiceRef: String!
    deelWorkerId: Int
    entity: String
    invoiceCurrency: Currency!
    invoiceDate: TimelessDate!
    invoiceSerial: String!
    itemDescription: String!
    payedDate: TimelessDate!
    receiptSerial: String!
    typeOfAdjustment: String!
    workerName: String
  }
`;
