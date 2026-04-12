// Example index.ts — module registration file.
// This is the entry point that wires typeDefs, resolvers, and providers together.
import { createModule } from 'graphql-modules';
import { ItemsProvider } from './providers/items.provider.js';
import { itemsResolvers } from './resolvers/items.resolver.js';
import itemsTypeDefs from './typeDefs/items.graphql.js';

// __dirname for ESM — required by graphql-modules for module resolution
const __dirname = new URL('.', import.meta.url).pathname;

export const itemsModule = createModule({
  id: 'items', // Unique module ID — used internally by graphql-modules
  dirname: __dirname,
  typeDefs: [itemsTypeDefs], // Array of DocumentNode from gql tags
  resolvers: [itemsResolvers], // Array of resolver maps
  providers: () => [ItemsProvider], // Factory function returning provider classes
});

// Re-export types namespace for use by other modules
export * as ItemsTypes from './types.js';
