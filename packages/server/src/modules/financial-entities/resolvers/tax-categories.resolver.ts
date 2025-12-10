import { GraphQLError } from 'graphql';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { FinancialEntitiesModule, IUpdateTaxCategoryParams } from '../types.js';
import { commonTaxChargeFields } from './common.js';

export const taxCategoriesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    taxCategories: async (_parent, _args, { injector }) => {
      return injector
        .get(TaxCategoriesProvider)
        .getAllTaxCategories()
        .then(res => res.filter(c => !!c.name));
    },
    taxCategory: async (_, { id }, { injector }) => {
      try {
        const res = await injector.get(TaxCategoriesProvider).taxCategoryByIdLoader.load(id);
        if (!res) {
          throw new Error('Nothing received from DB');
        }
        return res;
      } catch (error) {
        const message = `Tax category with ID="${id}" not found`;
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    taxCategoryByBusinessId: async (_, args, { injector }) => {
      const { businessId, ownerId } = args;
      return injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessAndOwnerIDsLoader.load({ businessId, ownerId })
        .then(res => res ?? null);
    },
  },
  Mutation: {
    updateTaxCategory: async (_, { taxCategoryId, fields }, { injector }) => {
      if (hasFinancialEntitiesCoreProperties(fields)) {
        await injector.get(FinancialEntitiesProvider).updateFinancialEntity({
          ...fields,
          financialEntityId: taxCategoryId,
          irsCode: fields.irsCode ?? null,
          isActive: fields.isActive ?? true,
        });
      }
      const adjustedFields: IUpdateTaxCategoryParams = {
        hashavshevetName: fields.hashavshevetName,
        taxExcluded: fields.taxExcluded,
        taxCategoryId,
      };
      try {
        if (fields.hashavshevetName || fields.taxExcluded != null) {
          await injector
            .get(TaxCategoriesProvider)
            .updateTaxCategory(adjustedFields)
            .catch((e: Error) => {
              const message = `Error updating tax category for business ID="${taxCategoryId}"`;
              console.error(`${message}: ${e}`);
              throw new Error(message);
            });
        }

        const updatedTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByIdLoader.load(taxCategoryId);
        if (!updatedTaxCategory) {
          throw new Error(`Updated tax category not found`);
        }
        return updatedTaxCategory;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update tax category ID="${taxCategoryId}": ${(e as Error).message}`,
        };
      }
    },
    insertTaxCategory: async (
      _,
      { fields },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        let irsCode = fields.irsCode ?? null;
        if (!irsCode && fields.sortCode) {
          const sortCode = await injector
            .get(SortCodesProvider)
            .getSortCodesByIdLoader.load(fields.sortCode);
          if (sortCode?.default_irs_code) {
            irsCode = sortCode.default_irs_code;
          }
        }
        const [financialEntity] = await injector
          .get(FinancialEntitiesProvider)
          .insertFinancialEntity({
            ownerId: defaultAdminBusinessId,
            name: fields.name,
            sortCode: fields.sortCode,
            type: 'tax_category',
            irsCode,
            isActive: fields.isActive ?? true,
          })
          .catch((e: Error) => {
            const message = `Failed to create financial entity: ${e.message}`;
            console.error(`${message}: ${e}`);
            throw new Error(message);
          });

        if (!financialEntity) {
          throw new Error('Failed to create core financial entity');
        }

        const [taxCategory] = await injector.get(TaxCategoriesProvider).insertTaxCategory({
          id: financialEntity.id,
          hashavshevetName: fields.hashavshevetName,
          taxExcluded: fields.taxExcluded ?? false,
        });

        return { ...financialEntity, ...taxCategory };
      } catch (e) {
        const message = 'Failed to create tax category';
        console.error(`${message}: ${e}`);
        throw new GraphQLError(message);
      }
    },
  },
  CommonCharge: commonTaxChargeFields,
  FinancialCharge: commonTaxChargeFields,
  ConversionCharge: commonTaxChargeFields,
  SalaryCharge: commonTaxChargeFields,
  InternalTransferCharge: commonTaxChargeFields,
  DividendCharge: commonTaxChargeFields,
  BusinessTripCharge: commonTaxChargeFields,
  MonthlyVatCharge: commonTaxChargeFields,
  BankDepositCharge: commonTaxChargeFields,
  ForeignSecuritiesCharge: commonTaxChargeFields,
  CreditcardBankCharge: commonTaxChargeFields,
  LtdFinancialEntity: {
    taxCategory: async (parent, _, { injector, adminContext: { defaultAdminBusinessId } }) => {
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByBusinessAndOwnerIDsLoader.load({
          businessId: parent.id,
          ownerId: defaultAdminBusinessId,
        });
      if (!taxCategory) {
        throw new GraphQLError(`Tax category for business ID="${parent.id}" not found`);
      }
      return taxCategory;
    },
  },
};
