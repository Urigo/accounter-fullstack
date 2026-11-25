import { GraphQLError } from 'graphql';
import type { Resolvers } from '../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { calculateTotalAmount } from '../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { resolveAssetLocalCost } from '../helpers/asset-cost.helper.js';
import { validateDepreciationPercentage } from '../helpers/depreciation-categories.helper.js';
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
          .updateDepreciationRecord({
            ...input,
            // null clears the local cost override; leaving it out keeps the stored one
            localAmount: input.localAmount ?? null,
            clearLocalAmount: input.localAmount === null,
            // null clears the asset account; leaving it out keeps the stored one
            assetTaxCategoryId: input.assetTaxCategoryId ?? null,
            clearAssetTaxCategoryId: input.assetTaxCategoryId === null,
          });

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
      const percentageError = validateDepreciationPercentage(input.percentage);
      if (percentageError) {
        return { __typename: 'CommonError', message: percentageError };
      }
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
      const percentageError = validateDepreciationPercentage(input.percentage);
      if (percentageError) {
        return { __typename: 'CommonError', message: percentageError };
      }
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
  ChargeMetadata: {
    depreciationRecordsCount: async (dbCharge, _, { injector }) => {
      return injector
        .get(DepreciationProvider)
        .getDepreciationRecordsByChargeIdLoader.load(dbCharge.id)
        .then(records => records.length);
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
      const { defaultLocalCurrency } = await injector
        .get(AdminContextProvider)
        .getVerifiedAdminContext();
      const [charge, amount] = await Promise.all([
        injector.get(ChargesProvider).getChargeByIdLoader.load(dbDepreciationRecord.charge_id),
        calculateTotalAmount(dbDepreciationRecord.charge_id, injector, defaultLocalCurrency),
      ]);
      if (!charge) {
        throw new GraphQLError(`Charge with id ${dbDepreciationRecord.charge_id} not found`);
      }
      if (!amount) {
        throw new GraphQLError(
          `Error calculating amount for depreciation record id ${dbDepreciationRecord.id}`,
        );
      }
      return formatFinancialAmount(amount.raw * -1, amount.currency);
    },
    localAmount: async (dbDepreciationRecord, _, { injector }) => {
      const [{ cost }, { defaultLocalCurrency }] = await Promise.all([
        resolveAssetLocalCost(injector, dbDepreciationRecord),
        injector.get(AdminContextProvider).getVerifiedAdminContext(),
      ]);
      return cost == null ? null : formatFinancialAmount(cost, defaultLocalCurrency);
    },
    assetTaxCategory: async (dbDepreciationRecord, _, { injector }) => {
      if (!dbDepreciationRecord.asset_tax_category_id) {
        return null;
      }
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByIdLoader.load(dbDepreciationRecord.asset_tax_category_id);
      if (!taxCategory) {
        throw new GraphQLError(
          `Tax category with id ${dbDepreciationRecord.asset_tax_category_id} not found`,
        );
      }
      return taxCategory;
    },
    localAmountOverride: dbDepreciationRecord =>
      dbDepreciationRecord.local_amount == null ? null : Number(dbDepreciationRecord.local_amount),
    exchangeRate: async (dbDepreciationRecord, _, { injector }) =>
      (await resolveAssetLocalCost(injector, dbDepreciationRecord)).rate,
    exchangeRateDate: async (dbDepreciationRecord, _, { injector }) =>
      (await resolveAssetLocalCost(injector, dbDepreciationRecord)).rateDate,
    activationDate: dbDepreciationRecord => dbDepreciationRecord.activation_date,
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
