import { GraphQLError } from 'graphql';
import { ChargeTagsProvider } from '../providers/charge-tags.provider.js';
import { TagsProvider } from '../providers/tags.provider.js';
import type { TagsModule } from '../types.js';
import { commonTagsChargeFields } from './common.js';

export const tagsResolvers: TagsModule.Resolvers = {
  Query: {
    allTags: (_, __, { injector }) => injector.get(TagsProvider).getAllTags(),
  },
  Mutation: {
    addTag: (_, { name }, { injector }) => {
      return injector
        .get(TagsProvider)
        .addNewTag({ name })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error adding tag "${name}"`);
        })
        .then(() => true);
    },
    deleteTag: (_, { id }, { injector }) => {
      return injector
        .get(TagsProvider)
        .deleteTag({ id })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error deleting tag id "${id}"`);
        })
        .then(() => true);
    },
    renameTag: (_, { id, newName }, { injector }) => {
      return injector
        .get(TagsProvider)
        .renameTag({ id, newName })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error renaming tag id "${id}"`);
        })
        .then(() => true);
    },
    updateTagParent: (_, { id, parentId }, { injector }) => {
      return injector
        .get(TagsProvider)
        .updateTagParent({ id, parentId })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error updating parent of tag id "${id}"`);
        })
        .then(() => true);
    },
    updateTagPart: (_, { tagId, chargeId, part }, { injector }) => {
      return injector
        .get(ChargeTagsProvider)
        .updateChargeTagPart({ tagId, chargeId, part })
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(
            `Error updating tag's part (id "${tagId}", charge id "${chargeId}")`,
          );
        })
        .then(() => true);
    },
  },
  Tag: {
    id: tag => tag.id!,
    name: tag => tag.name!,
    parent: (dbTag, _, { injector }) =>
      dbTag.parent
        ? injector
            .get(TagsProvider)
            .getTagByIDLoader.load(dbTag.parent)
            .then(res => res ?? null)
        : null,
    namePath: dbTag => dbTag.names_path,
    fullPath: (dbTag, _, { injector }) =>
      dbTag.ids_path
        ? dbTag.ids_path.map(id =>
            injector
              .get(TagsProvider)
              .getTagByIDLoader.load(id)
              .then(res => {
                if (!res) {
                  throw new Error(`Tag with id ${id}, ancestor of tag id ${dbTag.id} not found`);
                }
                return res;
              }),
          )
        : [],
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
