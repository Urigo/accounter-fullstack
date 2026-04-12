// Example resolver file for a GraphQL module.
// Resolvers map GraphQL operations to provider method calls.
// Import the shared error helper — standardizes error logging + GraphQLError wrapping
import { errorSimplifier } from '../../../shared/errors.js';
// Import the provider — used via injector.get(), never instantiated directly
import { ItemsProvider } from '../providers/items.provider.js';
// Import generated module resolver types — never hand-write these
import type { ItemsModule } from '../types.js';

// Type the full resolver map with the generated module type
export const itemsResolvers: ItemsModule.Resolvers = {
  Query: {
    // Resolver signature: (parent, args, { injector }) => ...
    allItems: async (_, __, { injector }) => {
      try {
        return await injector.get(ItemsProvider).getAllItems();
      } catch (error) {
        throw errorSimplifier('Error fetching items', error);
      }
    },
    item: async (_, { id }, { injector }) => {
      try {
        // Use DataLoader for single-record fetches — prevents N+1
        return await injector
          .get(ItemsProvider)
          .getItemByIdLoader.load(id)
          .then(item => item ?? null);
      } catch (error) {
        throw errorSimplifier(`Error fetching item ${id}`, error);
      }
    },
  },

  Mutation: {
    addItem: (_, { input }, { injector }) => {
      return injector
        .get(ItemsProvider)
        .addItem(input)
        .then(() => true)
        .catch(error => {
          throw errorSimplifier('Error adding item', error);
        });
    },
    updateItem: (_, { id, fields }, { injector }) => {
      return injector
        .get(ItemsProvider)
        .updateItem({ id, ...fields })
        .then(() => true)
        .catch(error => {
          throw errorSimplifier(`Error updating item ${id}`, error);
        });
    },
  },

  // Field resolvers on the module's own type — map DB snake_case to GraphQL camelCase
  Item: {
    id: dbItem => dbItem.id.toString(),
    name: dbItem => dbItem.name,
    code: dbItem => dbItem.code,
  },

  // Field resolvers on types from OTHER modules — cross-module relationships
  ParentEntity: {
    item: (parent, _, { injector }) =>
      parent?.item_id
        ? injector
            .get(ItemsProvider)
            .getItemByIdLoader.load(parent.item_id)
            .then(item => item ?? null)
        : null, // Return null when the FK is missing — don't throw
  },
};
