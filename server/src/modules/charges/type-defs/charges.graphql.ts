import { gql } from 'graphql-modules';

export const chargesSchema = gql`
  " The direction of the transaction "
  enum TransactionDirection {
    DEBIT
    CREDIT
  }

  " defines a tag / category for charge arrangement"
  type Tag {
    name: String!
  }

  " defines a link between a counterparty and their part in the charge "
  type BeneficiaryCounterparty {
    counterparty: Counterparty!
    percentage: Percentage!
  }

  " The other side of a transaction "
  interface Counterparty {
    name: String!
  }

  " represent a counterparty with a name "
  type NamedCounterparty implements Counterparty {
    name: String!
  }

  extend type Query {
    chargeById(id: ID!): Charge!
  }

  " input variables for charge filtering "
  input ChargeFilter {
    " Include only charges that doesn't have transactions linked "
    withoutTransaction: Boolean
    " Include only charges that doesn't have Ledger records linked "
    withoutLedger: Boolean
    " Include only charges that doesn't have documents linked "
    withoutDocuments: Boolean
    " Include only charges that doesn't have invoice document linked "
    withoutInvoice: Boolean
    " Include only charges occured after this date "
    fromDate: String
    " Include only charges occured before this date "
    toDate: String
  }

  " represrent a complex type for grouped charge with ledger info, bank/card transactions and documents "
  type Charge {
    id: ID!
    " when the initial charge was created from the first event we found "
    createdAt: Date!
    " list of financial/bank transactions linked to the charge "
    transactions: [Transaction!]!
    " calculated counterparty details for the charge "
    counterparty: Counterparty
    " user description, set manually by the user "
    description: String
    " user customer tags "
    tags: [Tag!]!
    " a list of beneficiaries and their part in the charge "
    beneficiaries: [BeneficiaryCounterparty!]!
    " the total amount of the charge "
    totalAmount: FinancialAmount
  }

  " Represent a general transaction object "
  interface Transaction {
    id: ID!
    " external key / identifier in the bank or card (אסמכתא) "
    referenceNumber: String!
    " eventDate "
    createdAt: Date!
    " debitDate "
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    " either credit or debit "
    direction: TransactionDirection!
    " the amount of the transaction "
    amount: FinancialAmount!
    " description of the transaction, as defined by the bank/card "
    description: String!
    " user custom note, saved by the bank "
    userNote: String
    " link to the account "
    account: FinancialAccount!
    " effective bank / card balance, after the transaction "
    balance: FinancialAmount!
  }

  " temp type until DB  supports transactions differenciation"
  type CommonTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate # TODO: this should be required, but lots are missing in the DB
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    balance: FinancialAmount!
  }

  " העברה "
  type WireTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    balance: FinancialAmount!
  }

  " עמלה "
  type FeeTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    balance: FinancialAmount!
  }

  " המרה "
  type ConversionTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: TimelessDate!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    balance: FinancialAmount!
    from: Currency!
    to: Currency!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRate: Rate
  }

  extend type LtdFinancialEntity {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type PersonalFinancialEntity {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend interface FinancialEntity {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend interface FinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type BankFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }

  extend type CardFinancialAccount {
    charges(filter: ChargeFilter): [Charge!]!
  }
`;
