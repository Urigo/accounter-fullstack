import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allTags: [Tag!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    addTag(name: String!, parentId: UUID): Boolean! @auth(role: ADMIN)
    deleteTag(id: UUID!): Boolean! @auth(role: ADMIN)
    renameTag(id: UUID!, newName: String!): Boolean! @auth(role: ADMIN)
    updateTagParent(id: UUID!, parentId: UUID): Boolean! @auth(role: ADMIN)
    updateTagPart(tagId: UUID!, chargeId: UUID!, part: Float!): Boolean! @auth(role: ADMIN)
    updateTag(id: UUID!, fields: UpdateTagFieldsInput!): Boolean! @auth(role: ADMIN)
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
