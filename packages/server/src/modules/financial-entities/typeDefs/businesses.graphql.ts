import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    business(id: UUID!): Business! @auth(role: ACCOUNTANT)
    businesses(ids: [UUID!]!): [Business!]! @auth(role: ACCOUNTANT)
    allBusinesses(page: Int, limit: Int, name: String): PaginatedBusinesses @auth(role: ACCOUNTANT)
  }

  " represent a financial entity of any type that may hold financial accounts (company, business, individual) "
  interface Business implements FinancialEntity {
    id: UUID!
    name: String!

    pcn874RecordType: Pcn874RecordType
    irsCode: Int
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  " response for paginated Financial Entities "
  type PaginatedBusinesses {
    nodes: [Business!]!
    pageInfo: PageInfo!
  }

  " Financial entity, identifier by ID, can be a company or individual "
  type LtdFinancialEntity implements FinancialEntity & Business {
    id: UUID!
    country: String!
    governmentId: String
    name: String!
    address: String

    hebrewName: String
    email: String
    website: String
    phoneNumber: String
    exemptDealer: Boolean
    optionalVAT: Boolean

    suggestions: Suggestions

    pcn874RecordType: Pcn874RecordType
    irsCode: Int
    isActive: Boolean!
    isReceiptEnough: Boolean
    isDocumentsOptional: Boolean
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  " input for business suggestions "
  type Suggestions {
    phrases: [String!]!
    tags: [Tag!]!
    description: String
    emails: [String!]
    emailListener: SuggestionsEmailListenerConfig
    priority: Int
  }

  " business suggestions email listener config "
  type SuggestionsEmailListenerConfig {
    internalEmailLinks: [String!]
    emailBody: Boolean
    attachments: [EmailAttachmentType!]
  }
  " types of email attachments that can be parsed "
  enum EmailAttachmentType {
    PDF
    PNG
    JPEG
  }

  " Financial entity, identifier by ID, represents an actual person "
  type PersonalFinancialEntity implements FinancialEntity & Business {
    id: UUID!
    name: String!
    email: String!

    pcn874RecordType: Pcn874RecordType
    irsCode: Int
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Mutation {
    updateBusiness(
      businessId: UUID!
      ownerId: UUID!
      fields: UpdateBusinessInput!
    ): UpdateBusinessResponse! @auth(role: ACCOUNTANT)
    insertNewBusiness(fields: InsertNewBusinessInput!): UpdateBusinessResponse!
      @auth(role: ACCOUNTANT)
    mergeBusinesses(targetBusinessId: UUID!, businessIdsToMerge: [UUID!]!): Business!
      @auth(role: ACCOUNTANT)
    batchGenerateBusinessesOutOfTransactions: [Business!]! @auth(role: ACCOUNTANT)
  }

  " result type for updateBusiness "
  union UpdateBusinessResponse = LtdFinancialEntity | CommonError

  " input for updateBusiness "
  input UpdateBusinessInput {
    name: String
    sortCode: Int

    country: String
    hebrewName: String
    address: String
    email: String
    website: String
    phoneNumber: String
    governmentId: String
    taxCategory: UUID
    exemptDealer: Boolean
    suggestions: SuggestionsInput
    optionalVAT: Boolean
    isReceiptEnough: Boolean
    isDocumentsOptional: Boolean

    pcn874RecordType: Pcn874RecordType
    irsCode: Int
    isActive: Boolean
  }

  " input for insertNewBusiness "
  input InsertNewBusinessInput {
    name: String!
    sortCode: Int

    country: String
    hebrewName: String
    address: String
    email: String
    website: String
    phoneNumber: String
    governmentId: String
    taxCategory: UUID
    exemptDealer: Boolean
    suggestions: SuggestionsInput
    optionalVAT: Boolean
    isReceiptEnough: Boolean
    isDocumentsOptional: Boolean
    pcn874RecordType: Pcn874RecordType
    irsCode: Int
    isActive: Boolean
  }

  " input for business suggestions "
  input SuggestionsInput {
    phrases: [String!]
    tags: [TagInput!]
    description: String
    emails: [String!]
    emailListener: SuggestionsEmailListenerConfigInput
    priority: Int
  }

  " input for business suggestions email listener config "
  input SuggestionsEmailListenerConfigInput {
    internalEmailLinks: [String!]
    emailBody: Boolean
    attachments: [EmailAttachmentType!]
  }

  extend interface Charge {
    " the financial entity that created the charge "
    owner: Business!
  }

  extend type CommonCharge {
    owner: Business!
  }

  extend type FinancialCharge {
    owner: Business!
  }

  extend type ConversionCharge {
    owner: Business!
  }

  extend type SalaryCharge {
    owner: Business!
  }

  extend type InternalTransferCharge {
    owner: Business!
  }

  extend type DividendCharge {
    owner: Business!
  }

  extend type BusinessTripCharge {
    owner: Business!
  }

  extend type MonthlyVatCharge {
    owner: Business!
  }

  extend type BankDepositCharge {
    owner: Business!
  }

  extend type ForeignSecuritiesCharge {
    owner: Business!
  }

  extend type CreditcardBankCharge {
    owner: Business!
  }
`;
