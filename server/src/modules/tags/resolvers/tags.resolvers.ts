import { TagsProvider } from '../providers/tags.provider.js';
import type { TagsModule } from '../types.js';

export const tagsResolvers: TagsModule.Resolvers = {
  Charge: {
    tags: (DbCharge, _, { injector }) =>
      injector
        .get(TagsProvider)
        .getTagsByChargeIDLoader.load(DbCharge.id)
        .then(tags => tags.map(tag => ({ name: tag.tag_name }))), // TODO(Gil): implement with new table
  },
};
