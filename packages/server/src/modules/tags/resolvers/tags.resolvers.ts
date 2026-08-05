import { GraphQLError } from 'graphql';
import type { Resolvers } from '../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../shared/constants.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { applyChargeTagChanges } from '../helpers/batch-charge-tags.helper.js';
import { ChargeTagsProvider } from '../providers/charge-tags.provider.js';
import { TagsProvider } from '../providers/tags.provider.js';
import type { TagsModule } from '../types.js';
import { commonTagsChargeFields } from './common.js';

export const tagsResolvers: TagsModule.Resolvers &
  Pick<Resolvers, 'BatchUpdateChargesTagsResult'> = {
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
    updateTagParent: (_, { id, parentId }, { injector }) => {
      return injector
        .get(TagsProvider)
        .updateTagParent({ id, parentId: parentId === EMPTY_UUID ? null : parentId })
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
    updateTag: async (_, { id, fields }, { injector }) => {
      const promises: Array<Promise<unknown>> = [];
      if (fields.name) {
        promises.push(
          injector
            .get(TagsProvider)
            .renameTag({ id, newName: fields.name })
            .catch(e => {
              console.error(JSON.stringify(e, null, 2));
              throw new GraphQLError(`Error renaming tag id "${id}"`);
            }),
        );
      }
      if (fields.parentId) {
        promises.push(
          injector
            .get(TagsProvider)
            .updateTagParent({
              id,
              parentId: fields.parentId === EMPTY_UUID ? null : fields.parentId,
            })
            .catch(e => {
              console.error(JSON.stringify(e, null, 2));
              throw new GraphQLError(`Error updating parent of tag id "${id}"`);
            }),
        );
      }
      if (promises.length === 0) {
        return true;
      }
      return Promise.all(promises)
        .then(() => true)
        .catch(e => {
          console.error(JSON.stringify(e, null, 2));
          throw new GraphQLError(`Error updating tag id "${id}"`);
        });
    },
    batchUpdateChargesTags: async (_, { chargeIds, addTagIds, removeTagIds }, { injector }) => {
      if (!chargeIds || chargeIds.length === 0) {
        return { __typename: 'CommonError', message: 'No charges provided' };
      }
      const addIds = addTagIds ?? [];
      const removeIds = removeTagIds ?? [];
      if (addIds.length === 0 && removeIds.length === 0) {
        return { __typename: 'CommonError', message: 'No tag changes provided' };
      }
      try {
        // `applyChargeTagChanges` removes then adds per charge, so an id in both lists ends up
        // added ("add wins") — no need to pre-filter the add list here.
        await applyChargeTagChanges(injector, chargeIds, addIds, removeIds);

        const loadedCharges = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.loadMany(chargeIds)
          .catch(e => {
            console.error(e);
            throw new GraphQLError('Error loading updated charges');
          });
        // Fail the whole op if any charge can't be reloaded, rather than silently returning a
        // partial set (mirrors batchUpdateCharges' post-load validation).
        if (loadedCharges.some(charge => !charge || charge instanceof Error)) {
          throw new GraphQLError(`Some updated charges not found (IDs "${chargeIds.join('", "')}")`);
        }
        const charges = loadedCharges as IGetChargesByIdsResult[];
        // Tag-only change: intentionally does NOT degrade accountant approval (matches the
        // `tags`-excluded-from-degrade convention used by updateCharge / batchUpdateCharges).
        return { charges };
      } catch (e) {
        let message = 'Error updating charges tags';
        if (e instanceof GraphQLError) {
          message = e.message;
        } else {
          console.error(e);
        }
        return { __typename: 'CommonError', message };
      }
    },
  },
  BatchUpdateChargesTagsResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'BatchUpdateChargesTagsSuccessfulResult';
    },
  },
  Tag: {
    id: tag => tag.id!,
    name: tag => tag.name!,
    ownerId: tag => tag.owner_id!,
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
  BankDepositCharge: commonTagsChargeFields,
  BusinessTripCharge: commonTagsChargeFields,
  CommonCharge: commonTagsChargeFields,
  ConversionCharge: commonTagsChargeFields,
  CreditcardBankCharge: commonTagsChargeFields,
  DividendCharge: commonTagsChargeFields,
  FinancialCharge: commonTagsChargeFields,
  ForeignSecuritiesCharge: commonTagsChargeFields,
  InternalTransferCharge: commonTagsChargeFields,
  MonthlyVatCharge: commonTagsChargeFields,
  SalaryCharge: commonTagsChargeFields,
};
