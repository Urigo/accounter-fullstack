import { GraphQLError } from 'graphql';
import { calculateTotalAmount } from '@modules/charges/helpers/common.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import type { Resolvers } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { DeprecationCategoriesProvider } from '../providers/deprecation-categories.provider.js';
import { DeprecationProvider } from '../providers/deprecation.provider.js';
import type { DeprecationModule } from '../types.js';

export const deprecationResolvers: DeprecationModule.Resolvers &
  Pick<
    Resolvers,
    | 'InsertDeprecationRecordResult'
    | 'UpdateDeprecationRecordResult'
    | 'InsertDeprecationCategoryResult'
    | 'UpdateDeprecationCategoryResult'
  > = {
  Query: {
    deprecationCategories: (_, __, { injector }) => {
      return injector.get(DeprecationCategoriesProvider).getAllDeprecationCategories();
    },
    deprecationRecordsByCharge: (_, { chargeId }, { injector }) => {
      return injector.get(DeprecationProvider).getDeprecationRecordsByChargeIdLoader.load(chargeId);
    },
  },
  Mutation: {
    updateDeprecationRecord: async (_, { input }, { injector }) => {
      try {
        const deprecationRecords = await injector
          .get(DeprecationProvider)
          .updateDeprecationRecord(input);

        if (!deprecationRecords || deprecationRecords.length === 0) {
          return {
            __typename: 'CommonError',
            message: 'Error updating deprecation record',
          };
        }
        return injector
          .get(DeprecationProvider)
          .getDeprecationRecordByIdLoader.load(deprecationRecords[0].id)
          .then(deprecationRecord => {
            if (!deprecationRecord) {
              throw new GraphQLError(
                `Deprecation record with id ${deprecationRecords[0].id} not found`,
              );
            }
            return deprecationRecord;
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error updating deprecation record',
        };
      }
    },
    deleteDeprecationRecord: (_, { deprecationRecordId }, { injector }) => {
      try {
        return injector
          .get(DeprecationProvider)
          .deleteDeprecationRecord({ deprecationRecordId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    deleteDeprecationRecordsByCharge: (_, { chargeId }, { injector }) => {
      try {
        return injector
          .get(DeprecationProvider)
          .deleteDeprecationRecordByChargeId({ chargeId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    insertDeprecationRecord: async (_, { input }, { injector }) => {
      try {
        const deprecationRecords = await injector
          .get(DeprecationProvider)
          .insertDeprecationRecord(input);

        if (!deprecationRecords || deprecationRecords.length === 0) {
          return {
            __typename: 'CommonError',
            message: 'Error inserting deprecation record',
          };
        }
        return injector
          .get(DeprecationProvider)
          .getDeprecationRecordByIdLoader.load(deprecationRecords[0].id)
          .then(deprecationRecord => {
            if (!deprecationRecord) {
              throw new GraphQLError(
                `Deprecation record with id ${deprecationRecords[0].id} not found`,
              );
            }
            return deprecationRecord;
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error inserting deprecation record',
        };
      }
    },
    updateDeprecationCategory: (_, { input }, { injector }) => {
      try {
        return injector
          .get(DeprecationCategoriesProvider)
          .updateDeprecationCategory(input)
          .then(deprecationCategories => {
            if (!deprecationCategories || deprecationCategories.length === 0) {
              return {
                __typename: 'CommonError',
                message: 'Error updating deprecation category',
              };
            }
            return deprecationCategories[0];
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error updating deprecation category',
        };
      }
    },
    insertDeprecationCategory: (_, { input }, { injector }) => {
      try {
        return injector
          .get(DeprecationCategoriesProvider)
          .insertDeprecationCategory(input)
          .then(deprecationCategories => {
            if (!deprecationCategories || deprecationCategories.length === 0) {
              return {
                __typename: 'CommonError',
                message: 'Error inserting deprecation category',
              };
            }
            return deprecationCategories[0];
          });
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: 'Error inserting deprecation category',
        };
      }
    },
    deleteDeprecationCategory: (_, { deprecationCategoryId }, { injector }) => {
      try {
        return injector
          .get(DeprecationCategoriesProvider)
          .deleteDeprecationCategory({ deprecationCategoryId })
          .then(() => true);
      } catch (e) {
        console.error(e);
        return false;
      }
    },
  },
  InsertDeprecationRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DeprecationRecord';
    },
  },
  UpdateDeprecationRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DeprecationRecord';
    },
  },
  InsertDeprecationCategoryResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DeprecationCategory';
    },
  },
  UpdateDeprecationCategoryResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'DeprecationCategory';
    },
  },
  CommonCharge: {
    deprecationRecords: async (dbCharge, _, { injector }) => {
      return injector
        .get(DeprecationProvider)
        .getDeprecationRecordsByChargeIdLoader.load(dbCharge.id);
    },
  },
  DeprecationRecord: {
    charge: (dbDeprecationRecord, _, { injector }) => {
      return injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(dbDeprecationRecord.charge_id)
        .then(charge => {
          if (!charge) {
            throw new GraphQLError(`Charge with id ${dbDeprecationRecord.charge_id} not found`);
          }
          return charge;
        });
    },
    chargeId: dbDeprecationRecord => dbDeprecationRecord.charge_id,
    amount: async (dbDeprecationRecord, _, { injector }) => {
      if (dbDeprecationRecord.amount && dbDeprecationRecord.currency) {
        return formatFinancialAmount(dbDeprecationRecord.amount, dbDeprecationRecord.currency);
      }
      const charge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(dbDeprecationRecord.charge_id);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${dbDeprecationRecord.charge_id} not found`);
      }
      const amount = calculateTotalAmount(charge);
      if (!amount) {
        throw new GraphQLError(
          `Error calculating amount for deprecation record id ${dbDeprecationRecord.id}`,
        );
      }
      return formatFinancialAmount(amount.raw * -1, amount.currency);
    },
    activationDate: dbDeprecationRecord =>
      dateToTimelessDateString(dbDeprecationRecord.activation_date),
    category: async (dbDeprecationRecord, _, { injector }) => {
      return injector
        .get(DeprecationCategoriesProvider)
        .getDeprecationCategoriesByIdLoader.load(dbDeprecationRecord.category)
        .then(category => {
          if (!category) {
            throw new GraphQLError(
              `Deprecation category with id ${dbDeprecationRecord.category} not found`,
            );
          }
          return category;
        });
    },
    type: dbDeprecationRecord => dbDeprecationRecord.type,
  },
  DeprecationCategory: {
    id: dbCategory => dbCategory.id,
    name: dbCategory => dbCategory.name,
    percentage: dbCategory => Number(dbCategory.percentage),
  },
};
