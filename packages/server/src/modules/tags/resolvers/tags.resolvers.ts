import { GraphQLError } from 'graphql';
import { TagsProvider } from '../providers/tags.provider.js';
import type { TagsModule } from '../types.js';
import { commonTagsChargeFields } from './common.js';

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
    renameTag: (_, { prevName, newName }, { injector }) => {
      return injector
        .get(TagsProvider)
        .updateTagCategory({ prevTagName: prevName, newTagName: newName })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error renaming tag "${name}"`);
        })
        .then(() => true);
    },
  },
  CommonCharge: commonTagsChargeFields,
  ConversionCharge: commonTagsChargeFields,
  SalaryCharge: commonTagsChargeFields,
  InternalTransferCharge: commonTagsChargeFields,
  DividendCharge: commonTagsChargeFields,
  BusinessTripCharge: commonTagsChargeFields,
  MonthlyVatCharge: commonTagsChargeFields,
  BankDepositCharge: commonTagsChargeFields,
  CreditcardBankCharge: commonTagsChargeFields,
};
