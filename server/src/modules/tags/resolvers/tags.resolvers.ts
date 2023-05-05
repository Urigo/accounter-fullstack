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
  Charge: {
    tags: (DbCharge, _, { injector }) =>
      injector
        .get(TagsProvider)
        .getTagsByChargeIDLoader.load(DbCharge.id)
        .then(tags => tags.map(tag => ({ name: tag.tag_name }))), // TODO(Gil): implement with new table
  },
};
