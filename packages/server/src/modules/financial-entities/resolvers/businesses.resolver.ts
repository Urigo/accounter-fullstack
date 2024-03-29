import { Resolvers } from '@shared/gql-types';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  FinancialEntitiesModule,
  IUpdateBusinessParams,
  IUpdateBusinessTaxCategoryParams,
} from '../types.js';
import { commonChargeFields, commonFinancialEntityFields } from './common.js';

export const businessesResolvers: FinancialEntitiesModule.Resolvers &
  Pick<Resolvers, 'Business' | 'UpdateBusinessResponse'> = {
  Query: {
    business: async (_, { id }, { injector }) => {
      const dbFe = await injector.get(BusinessesProvider).getBusinessByIdLoader.load(id);
      if (!dbFe) {
        throw new Error(`Financial entity ID="${id}" not found`);
      }

      return dbFe;
    },
    allBusinesses: async (_, { page, limit }, { injector }) => {
      const businesses = await injector.get(BusinessesProvider).getAllBusinesses();

      page ??= 1;
      let pageBusinesses = businesses.sort((a, b) =>
        a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1,
      );

      // handle pagination
      if (limit) {
        pageBusinesses = businesses.slice(page * limit - limit, page * limit);
      }

      return {
        __typename: 'PaginatedBusinesses',
        nodes: pageBusinesses,
        pageInfo: {
          totalPages: limit ? Math.ceil(businesses.length / limit) : 1,
          currentPage: page + 1,
          pageSize: limit,
        },
      };
    },
  },
  Mutation: {
    updateBusiness: async (_, { businessId, ownerId, fields }, { injector }) => {
      if (hasFinancialEntitiesCoreProperties(fields)) {
        await injector
          .get(FinancialEntitiesProvider)
          .updateFinancialEntity({ ...fields, financialEntityId: businessId });
      }
      const adjustedFields: IUpdateBusinessParams = {
        address: fields.address,
        email: fields.email,
        vatNumber: fields.governmentId,
        hebrewName: fields.hebrewName,
        phoneNumber: fields.phoneNumber,
        website: fields.website,
        businessId,
      };
      try {
        if (
          fields.hebrewName ||
          fields.address ||
          fields.email ||
          fields.governmentId ||
          fields.phoneNumber ||
          fields.website
        ) {
          await injector
            .get(BusinessesProvider)
            .updateBusiness(adjustedFields)
            .catch((e: Error) => {
              console.error(e);
              throw new Error(`Update core business fields error`);
            });
        }

        if (fields.taxCategory) {
          const texCategoryParams: IUpdateBusinessTaxCategoryParams = {
            businessId,
            ownerId,
            taxCategoryId: fields.taxCategory,
          };
          try {
            await injector.get(TaxCategoriesProvider).insertBusinessTaxCategory(texCategoryParams);
          } catch (error) {
            await injector
              .get(TaxCategoriesProvider)
              .updateBusinessTaxCategory(texCategoryParams)
              .catch((e: Error) => {
                console.error(e);
                throw new Error(`Update tax category error`);
              });
          }
        }

        const updatedBusiness = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(businessId);
        if (!updatedBusiness) {
          throw new Error(`Updated business not found`);
        }
        return updatedBusiness;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update business ID="${businessId}": ${(e as Error).message}`,
        };
      }
    },
  },
  Business: {
    __resolveType: async (
      parent,
      { injector },
    ): Promise<'LtdFinancialEntity' | 'PersonalFinancialEntity' | null> => {
      if (!parent.country) {
        const business = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(parent.id);
        if (business) {
          Object.assign(parent, business);
        }
      }
      return 'LtdFinancialEntity';
    },
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
    governmentId: DbBusiness => DbBusiness.vat_number,
    name: DbBusiness => DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew,

    hebrewName: DbBusiness => DbBusiness.hebrew_name,
    email: DbBusiness => DbBusiness.email,
    website: DbBusiness => DbBusiness.website,
    phoneNumber: DbBusiness => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
    name: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
  },
  UpdateBusinessResponse: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'LtdFinancialEntity';
    },
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
};
