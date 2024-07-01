import tags from './typeDefs/tags.graphql.js';
import { createModule } from 'graphql-modules';
import { ChargeTagsProvider } from './providers/charge-tags.provider.js';
import { TagsProvider } from './providers/tags.provider.js';
import { tagsResolvers } from './resolvers/tags.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const tagsModule = createModule({
  id: 'tags',
  dirname: __dirname,
  typeDefs: [tags],
  resolvers: [tagsResolvers],
  providers: [TagsProvider, ChargeTagsProvider],
});

export * as TagsTypes from './types.js';
