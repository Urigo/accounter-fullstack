import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allTags: [Tag!]! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    addTag(name: String!): Boolean! @auth(role: ADMIN)
    deleteTag(name: String!): Boolean! @auth(role: ADMIN)
    renameTag(prevName: String!, newName: String!): Boolean! @auth(role: ADMIN)
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

  " defines a tag / category for charge arrangement" # eslint-disable-next-line @graphql-eslint/strict-id-in-types -- no current solution for this
  type Tag {
    name: String!
  }

  extend input UpdateChargeInput {
    tags: [TagInput!]
  }

  " input variables for Tag"
  input TagInput {
    name: String!
  }
`;
