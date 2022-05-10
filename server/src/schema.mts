import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { resolvers } from './resolvers.mjs';

const typeDefs = /* GraphQL */ `
  # Scalars
  scalar URL
  scalar Date
  scalar Percentage
  scalar Rate
  scalar IBAN

  # Common Types
  " a date range "
  type DateRange {
    start: Date!
    end: Date!
  }

  interface Linkable {
    file: URL
  }

  " represent a generic document with identifier and a URL "
  interface Document implements Linkable {
    id: ID!
    " previewable image "
    image: URL!
    " link to original file gmail, pdf "
    file: URL
  }

  " Represent financial amount "
  type FinancialAmount {
    " the raw amount, for example: 19.99 "
    raw: Float!
    " formatted value with the currency symbol, like: 10$ "
    formatted: String!
    " currency of the amount "
    currency: Currency!
  }

  " All possible currencies "
  enum Currency {
    USD
    NIS
    GBP
    EUR
  }

  interface Counterparty {
    name: String!
  }

  " The direction of the transaction "
  enum TransactionDirection {
    DEBIT
    CREDIT
  }

  # Root types
  type Query {
    financialEntity(id: ID!): FinancialEntity!
  }

  # Main Module
  " Financial entity, identifier by ID, can be a company or invdividual "
  type LtdFinancialEntity implements FinancialEntity {
    id: ID!
    govermentId: String!
    name: String!
    address: String!

    englishName: String
    email: String
    website: String
    phoneNumber: String

    accounts: [FinancialAccount!]!
    charges(filter: ChargeFilter): [Charge!]!
    linkedEntities: [FinancialEntity!]!
  }

  type PersonalFinancialEntity implements FinancialEntity {
    id: ID!
    name: String!
    email: String!

    accounts: [FinancialAccount!]!
    charges(filter: ChargeFilter): [Charge!]!

    linkedEntities: [FinancialEntity!]!
    documents: [Document]
  }

  interface FinancialEntity {
    id: ID!
    accounts: [FinancialAccount!]!
    charges(filter: ChargeFilter): [Charge!]!

    linkedEntities: [FinancialEntity!]!
  }

  input ChargeFilter {
    " Include only charges that doesn't have transactions linked "
    withoutTransaction: Boolean
    " Include only charges that doesn't have Ledger records linked "
    withoutLedger: Boolean
    " Include only charges that doesn't have documents linked "
    withoutDocuments: Boolean
    " Include only charges that doesn't have invoice document linked "
    withoutInvoice: Boolean
  }

  " represrent a complex type for grouped charge with ledger info, bank/card transactions and documents "
  type Charge {
    id: ID!
    " when the initial charge was created from the first event we found "
    createdAt: Date!
    " additional documents attached to the charge "
    additionalDocument: [Linkable!]!
    " ledger records linked to the charge "
    ledgerRecords: [LedgerRecord!]!
    " list of financial/bank transactions linked to the charge "
    transactions: [Transaction!]!
    " calculated counterparty details for the charge "
    counterparty: Counterparty!
    " user description, set manually by the user "
    description: String
    " user customer tags "
    tags: [String!]!
    " a list of beneficiaries and their part in the charge "
    beneficiaries: [BeneficiaryCounterparty!]!
  }

  " defines a link between a counterparty and their part in the charge "
  type BeneficiaryCounterparty {
    counterparty: Counterparty!
    percentage: Percentage
  }

  # Taxes Module
  extend type Charge {
    " calculated field based on the actual ledger records, optional because not all charges has VAT "
    vat: FinancialAmount
    " withholding tax "
    withholdingTax: FinancialAmount
    " linked invoice document "
    invoice: Invoice
    " calculated based on ledger record and transaction approvals "
    accountantApproval: Boolean!
    " פחת, ציוד  "
    property: Boolean
  }

  extend type LedgerRecord {
    accountantApproval: AccountantApproval!
    " in shekels at the moment"
    localCurrencyAmount: FinancialAmount!
  }

  extend interface Transaction {
    accountantApproval: AccountantApproval!
  }

  type AccountantApproval {
    approved: Boolean!
    remark: String
  }

  # Hashavshevet Module
  extend type LedgerRecord {
    hashavshevetId: String
  }

  extend interface Transaction {
    hashavshevetId: String
  }

  # Business Trip Module
  extend type Charge {
    " should be later in busines trip module? "
    businessTrip: BusinessTrip!
  }

  extend input ChargeFilter {
    " filter by business trip (should be later in busines trip module?) "
    businessTrip: ID
  }

  type BusinessTrip {
    id: ID!
    name: String!
    dates: DateRange!
  }

  type Unprocessed implements Document & Linkable {
    id: ID!
    image: URL!
    file: URL
  }

  " invoice document "
  type Invoice implements Document & Linkable {
    id: ID!
    image: URL!
    file: URL

    serialNumber: String!
    date: Date!
    amount: FinancialAmount!
  }

  " proforma document "
  type Proforma implements Document & Linkable {
    id: ID!
    image: URL!
    file: URL

    serialNumber: String!
    date: Date!
    amount: FinancialAmount!
  }

  " receipt document "
  type Receipt implements Document & Linkable {
    id: ID!
    " previewable image "
    image: URL!
    " gmail, pdf "
    file: URL

    invoice: Invoice
    serialNumber: String!
    date: Date!
  }

  " Represent a general transaction object "
  interface Transaction {
    id: ID!
    " external key / identifier in the bank or card (אסמכתא) "
    referenceNumber: String!
    " eventDate "
    createdAt: Date!
    " debitDate "
    effectiveDate: Date!
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

  " העברה "
  type WireTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: Date!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    accountantApproval: AccountantApproval!
    hashavshevetId: String
    balance: FinancialAmount!
  }

  " עמלה "
  type FeeTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: Date!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    accountantApproval: AccountantApproval!
    hashavshevetId: String
    balance: FinancialAmount!
  }

  " המרה "
  type ConversionTransaction implements Transaction {
    id: ID!
    referenceNumber: String!
    createdAt: Date!
    effectiveDate: Date!
    direction: TransactionDirection!
    amount: FinancialAmount!
    description: String!
    userNote: String
    account: FinancialAccount!
    accountantApproval: AccountantApproval!
    hashavshevetId: String
    balance: FinancialAmount!

    from: Currency!
    to: Currency!
    " המרה של הבנק "
    bankRate: Rate!
    " בנק ישראל "
    officialRate: Rate
  }

  type LedgerRecord {
    id: ID!
    creditAccount: Counterparty
    debitAccount: Counterparty
    originalAmount: FinancialAmount!
    date: Date!
    description: String!
  }

  type NamedCounterparty implements Counterparty {
    name: String!
  }

  " Represent something external that we scrape, like bank or card "
  interface FinancialAccount {
    id: ID!
    charges(filter: ChargeFilter): [Charge!]!
  }

  type BankFinancialAccount implements FinancialAccount {
    id: ID!
    charges(filter: ChargeFilter): [Charge!]!

    " the external identifier of the bank account "
    accountNumber: String!
    bankNumber: String!
    branchNumber: String!
    " calculate based on bank+branch "
    routingNumber: String!

    " the external identifier of the bank account "
    iban: IBAN!

    " swift "
    swift: String!

    " country "
    country: String!

    " the name of the bank account"
    name: String
  }

  type CardFinancialAccount implements FinancialAccount {
    id: ID!
    charges(filter: ChargeFilter): [Charge!]!

    " the external identifier of the card "
    number: String!
    fourDigits: String!
  }
`;

export const schema = makeExecutableSchema({ typeDefs, resolvers });
const schemaWithMocks = addMocksToSchema({ schema });
