// Example typeDefs file for a GraphQL module.
// Uses the `gql` tag from graphql-modules (NOT from graphql-tag or apollo).
import { gql } from 'graphql-modules';

// Default export — the module's index.ts passes this to createModule({ typeDefs: [...] })
export default gql`
  # Extend root Query — each module adds its own queries
  extend type Query {
    allItems: [Item!]! @requiresAuth
    item(id: ID!): Item @requiresAuth
  }

  # Extend root Mutation — auth directives control access
  extend type Mutation {
    addItem(input: AddItemInput!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
    updateItem(id: ID!, fields: UpdateItemFieldsInput!): Boolean!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }

  # Input types for mutations — use descriptive field names
  input AddItemInput {
    name: String!
    code: Int!
  }

  input UpdateItemFieldsInput {
    name: String
    code: Int
  }

  # The module's own type — PascalCase name, camelCase fields
  type Item {
    id: ID!
    name: String
    code: Int!
  }

  # Extend types from other modules to add cross-module relationships
  extend type ParentEntity {
    item: Item
  }
`;
