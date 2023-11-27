import { gql } from 'graphql-modules';

// eslint-disable-next-line import/no-default-export
export default gql`
  extend type Query {
    allTags: [Tag!]!
  }

  extend type Mutation {
    addTag(name: String!): Boolean!
    deleteTag(name: String!): Boolean!
    renameTag(prevName: String!, newName: String!): Boolean!
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
