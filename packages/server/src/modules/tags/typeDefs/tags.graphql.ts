import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    allTags: [Tag!]! @requiresAuth
  }

  extend type Mutation {
    addTag(name: String!, parentId: UUID): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    deleteTag(id: UUID!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateTagParent(id: UUID!, parentId: UUID): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateTagPart(tagId: UUID!, chargeId: UUID!, part: Float!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateTag(id: UUID!, fields: UpdateTagFieldsInput!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  " input variables for updateTag "
  input UpdateTagFieldsInput {
    name: String
    parentId: UUID
  }

  extend interface Charge {
    " user customer tags "
    tags: [Tag!]!
  }

  extend type CommonCharge {
    tags: [Tag!]!
  }

  extend type FinancialCharge {
    tags: [Tag!]!
  }

  extend type ConversionCharge {
    tags: [Tag!]!
  }

  extend type SalaryCharge {
    tags: [Tag!]!
  }

  extend type InternalTransferCharge {
    tags: [Tag!]!
  }

  extend type DividendCharge {
    tags: [Tag!]!
  }

  extend type BusinessTripCharge {
    tags: [Tag!]!
  }

  extend type MonthlyVatCharge {
    tags: [Tag!]!
  }

  extend type BankDepositCharge {
    tags: [Tag!]!
  }

  extend type CreditcardBankCharge {
    tags: [Tag!]!
  }

  extend type ForeignSecuritiesCharge {
    tags: [Tag!]!
  }

  " defines a tag / category for charge arrangement"
  type Tag {
    name: String!
    id: UUID!
    parent: Tag
    namePath: [String!]
    fullPath: [Tag!]
  }

  extend input UpdateChargeInput {
    tags: [TagInput!]
  }

  " input variables for Tag"
  input TagInput {
    id: String!
  }
`;
