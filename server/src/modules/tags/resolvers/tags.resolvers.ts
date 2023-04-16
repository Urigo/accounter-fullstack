import type { TagsModule } from '../types.js';

export const tagsResolvers: TagsModule.Resolvers = {
  Charge: {
    // tags: DbCharge => (DbCharge.personal_category ? [{ name: DbCharge.personal_category }] : []), // TODO(Gil): implement with new table
  },
};
