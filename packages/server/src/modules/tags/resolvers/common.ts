import { ChargeTagsProvider } from '../providers/charge-tags.provider.js';
import { TagsModule } from '../types.js';

export const commonTagsChargeFields: TagsModule.ChargeResolvers = {
  tags: async (DbCharge, _, { injector }) => {
    return injector
      .get(ChargeTagsProvider)
      .getTagsByChargeIDLoader.load(DbCharge.id)
      .then(res => {
        if (!res) {
          return [];
        }
        return res;
      });
  },
};
