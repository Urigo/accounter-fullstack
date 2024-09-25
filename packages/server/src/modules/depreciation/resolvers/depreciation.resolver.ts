import { GraphQLError } from 'graphql';
import { calculateTotalAmount } from '@modules/charges/helpers/common.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { Resolvers } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { DepreciationCategoriesProvider } from '../providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '../providers/depreciation.provider.js';
import type { DepreciationModule } from '../types.js';

export const depreciationResolvers: DepreciationModule.Resolvers &
  Pick<
    Resolvers,
    | 'InsertDepreciationRecordResult'
    | 'UpdateDepreciationRecordResult'
    | 'InsertDepreciationCategoryResult'
    | 'UpdateDepreciationCategoryResult'
  > = {
  Query: {
    depreciationCategories: (_, __, { injector }) => {
      return injector.get(DepreciationCategoriesProvider).getAllDepreciationCategories();
    },
    depreciationRecordsByCharge: (_, { chargeId }, { injector }) => {
      return injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByChargeIdLoader.load(chargeId);
    },
  },
  Mutation: {
    updateDepreciationRecord: async (_, { input }, { injector }) => {
      try {
        const depreciationRecords = await injector
          .get(DepreciationProvider)
          .updateDepreciationRecord(input);

        if (!depreciationRecords || depreciationRecords.length === 0) {
          return {
            __typename: 'CommonError',
            message: 'Error updating depreciation record',
          };
        }
        return injector
          .get(DepreciationProvider)
          .getDepreciationRecordByIdLoader.load(depreciationRecords[0].id)
          .then(depreciationRecord => {
            if (!depreciationRecord) {
              throw new GraphQLError(
                `Depreciation record with id ${depreciationRecords[0].id} not found`,
              );
            }
            return depreciationRecord;
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error updating depreciation record',
        };
      }
    },
    deleteDepreciationRecord: (_, { depreciationRecordId }, { injector }) => {
      try {
        return injector
          .get(DepreciationProvider)
          .deleteDepreciationRecord({ depreciationRecordId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    deleteDepreciationRecordsByCharge: (_, { chargeId }, { injector }) => {
      try {
        return injector
          .get(DepreciationProvider)
          .deleteDepreciationRecordByChargeId({ chargeId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    insertDepreciationRecord: async (_, { input }, { injector }) => {
      try {
        const depreciationRecords = await injector
          .get(DepreciationProvider)
          .insertDepreciationRecord(input);

        if (!depreciationRecords || depreciationRecords.length === 0) {
          return {
            __typename: 'CommonError',
            message: 'Error inserting depreciation record',
          };
        }
        return injector
          .get(DepreciationProvider)
          .getDepreciationRecordByIdLoader.load(depreciationRecords[0].id)
          .then(depreciationRecord => {
            if (!depreciationRecord) {
              throw new GraphQLError(
                `Depreciation record with id ${depreciationRecords[0].id} not found`,
              );
            }
            return depreciationRecord;
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error inserting depreciation record',
        };
      }
    },
    updateDepreciationCategory: (_, { input }, { injector }) => {
      try {
        return injector
          .get(DepreciationCategoriesProvider)
          .updateDepreciationCategory(input)
          .then(depreciationCategories => {
            if (!depreciationCategories || depreciationCategories.length === 0) {
              return {
                __typename: 'CommonError',
                message: 'Error updating depreciation category',
              };
            }
            return depreciationCategories[0];
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error updating depreciation category',
        };
      }
    },
    insertDepreciationCategory: (_, { input }, { injector }) => {
      try {
        return injector
          .get(DepreciationCategoriesProvider)
          .insertDepreciationCategory(input)
          .then(depreciationCategories => {
            if (!depreciationCategories || depreciationCategories.length === 0) {
              return {
                __typename: 'CommonError',
                message: 'Error inserting depreciation category',
              };
            }
            return depreciationCategories[0];
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error inserting depreciation category',
        };
      }
    },
    deleteDepreciationCategory: (_, { depreciationCategoryId }, { injector }) => {
      try {
        return injector
          .get(DepreciationCategoriesProvider)
          .deleteDepreciationCategory({ depreciationCategoryId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
  },
  InsertDepreciationRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DepreciationRecord';
    },
  },
  UpdateDepreciationRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DepreciationRecord';
    },
  },
  InsertDepreciationCategoryResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DepreciationCategory';
    },
  },
  UpdateDepreciationCategoryResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DepreciationCategory';
    },
  },
  CommonCharge: {
    depreciationRecords: async (dbCharge, _, { injector }) => {
      return injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByChargeIdLoader.load(dbCharge.id);
    },
  },
  DepreciationRecord: {
    charge: (dbDepreciationRecord, _, { injector }) => {
      return injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(dbDepreciationRecord.charge_id)
        .then(charge => {
          if (!charge) {
            throw new GraphQLError(`Charge with id ${dbDepreciationRecord.charge_id} not found`);
          }
          return charge;
        });
    },
    chargeId: dbDepreciationRecord => dbDepreciationRecord.charge_id,
    amount: async (dbDepreciationRecord, _, { injector }) => {
      if (dbDepreciationRecord.amount && dbDepreciationRecord.currency) {
        return formatFinancialAmount(dbDepreciationRecord.amount, dbDepreciationRecord.currency);
      }
      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(dbDepreciationRecord.charge_id);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${dbDepreciationRecord.charge_id} not found`);
      }
      const amount = calculateTotalAmount(charge);
      if (!amount) {
        throw new GraphQLError(
          `Error calculating amount for depreciation record id ${dbDepreciationRecord.id}`,
        );
      }
      return formatFinancialAmount(amount.raw * -1, amount.currency);
    },
    activationDate: dbDepreciationRecord =>
      dateToTimelessDateString(dbDepreciationRecord.activation_date),
    category: async (dbDepreciationRecord, _, { injector }) => {
      return injector
        .get(DepreciationCategoriesProvider)
        .getDepreciationCategoriesByIdLoader.load(dbDepreciationRecord.category)
        .then(category => {
          if (!category) {
            throw new GraphQLError(
              `Depreciation category with id ${dbDepreciationRecord.category} not found`,
            );
          }
          return category;
        });
    },
    type: dbDepreciationRecord => dbDepreciationRecord.type,
  },
  DepreciationCategory: {
    id: dbCategory => dbCategory.id,
    name: dbCategory => dbCategory.name,
    percentage: dbCategory => Number(dbCategory.percentage),
  },
};
