import { gql } from 'graphql-modules';

export default gql`
  extend type Charge {
    " user customer tags "
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
