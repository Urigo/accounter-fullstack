import { tagsResolvers } from './resolvers/tags.resolvers.js';
import tags from './typeDefs/tags.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const tagsModule = createModule({
  id: 'tags',
  dirname: __dirname,
  typeDefs: [tags],
  resolvers: [tagsResolvers],
});
