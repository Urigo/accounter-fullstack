import { TagsProvider } from '../providers/tags.provider.js';
import { TagsModule } from '../types.js';

export const commonTaxChargeFields: TagsModule.ChargeResolvers = {
  tags: (DbCharge, _, { injector }) =>
    injector
      .get(TagsProvider)
      .getTagsByChargeIDLoader.load(DbCharge.id)
      .then(tags => tags.map(tag => ({ name: tag.tag_name }))),
};
