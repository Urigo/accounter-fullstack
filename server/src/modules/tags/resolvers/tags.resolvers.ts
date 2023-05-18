import { GraphQLError } from 'graphql';
import { TagsProvider } from '../providers/tags.provider.js';
import type { TagsModule } from '../types.js';

export const tagsResolvers: TagsModule.Resolvers = {
  Query: {
    allTags: (_, __, { injector }) =>
      injector
        .get(TagsProvider)
        .getAllTags()
        .then(res => res.rows.map(tag => ({ name: tag.unnest }))),
  },
  Mutation: {
    addTag: (_, { name }, { injector }) => {
      return injector
        .get(TagsProvider)
        .addTagCategory({ tagName: name })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error adding tag "${name}"`);
        })
        .then(() => true);
    },
    deleteTag: (_, { name }, { injector }) => {
      return injector
        .get(TagsProvider)
        .removeTagCategory({ tagName: name })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error deleting tag "${name}"`);
        })
        .then(() => true);
    },
  },
  Charge: {
    tags: (DbCharge, _, { injector }) =>
      injector
        .get(TagsProvider)
        .getTagsByChargeIDLoader.load(DbCharge.id)
        .then(tags => tags.map(tag => ({ name: tag.tag_name }))), // TODO(Gil): implement with new table
  },
};
