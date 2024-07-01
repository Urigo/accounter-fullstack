import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { Resolvers } from '@shared/gql-types';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { filterBusinessByName } from '../helpers/utils.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  FinancialEntitiesModule,
  IInsertBusinessParams,
  IInsertBusinessTaxCategoryResult,
  IUpdateBusinessParams,
  IUpdateBusinessTaxCategoryParams,
  Json,
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
    allBusinesses: async (_, { page, limit, name }, { injector }) => {
      const businesses = await injector.get(BusinessesProvider).getAllBusinesses();

      const filteredBusinesses = businesses.filter(business =>
        filterBusinessByName(business, name),
      );

      page ??= 1;
      let pageBusinesses = filteredBusinesses.sort((a, b) =>
        a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1,
      );

      // handle pagination
      if (limit) {
        pageBusinesses = filteredBusinesses.slice(page * limit - limit, page * limit);
      }

      return {
        __typename: 'PaginatedBusinesses',
        nodes: pageBusinesses,
        pageInfo: {
          totalPages: limit ? Math.ceil(filteredBusinesses.length / limit) : 1,
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
        exemptDealer: fields.exemptDealer,
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
          fields.website ||
          fields.exemptDealer
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
    insertNewBusiness: async (_, { fields }, { injector }) => {
      try {
        const [financialEntity] = await injector
          .get(FinancialEntitiesProvider)
          .insertFinancialEntity({
            ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
            name: fields.name,
            sortCode: fields.sortCode,
            type: 'business',
          })
          .catch((e: Error) => {
            console.error(e);
            return [];
          });

        if (!financialEntity) {
          return {
            __typename: 'CommonError',
            message: `Failed to create core financial entity`,
          };
        }

        const suggestions: IInsertBusinessParams['suggestions'] = fields.suggestions
          ? ({
              tags: fields.suggestions.tags?.map(tag => tag.id),
              phrases: fields.suggestions.phrases?.map(phrase => phrase),
              description: fields.suggestions.description ?? undefined,
            } as Json)
          : undefined;

        const insertBusinessPromise = injector.get(BusinessesProvider).insertBusiness({
          id: financialEntity.id,
          address: fields.address,
          email: fields.email,
          exemptDealer: fields.exemptDealer ?? false,
          governmentId: fields.governmentId,
          hebrewName: fields.hebrewName,
          phoneNumber: fields.phoneNumber,
          website: fields.website,
          suggestions,
        });

        let taxCategoryPromise: Promise<IInsertBusinessTaxCategoryResult | void> =
          Promise.resolve();
        if (fields.taxCategory) {
          const texCategoryParams: IUpdateBusinessTaxCategoryParams = {
            businessId: financialEntity.id,
            ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
            taxCategoryId: fields.taxCategory,
          };
          taxCategoryPromise = injector
            .get(TaxCategoriesProvider)
            .insertBusinessTaxCategory(texCategoryParams)
            .then(res => res[0])
            .catch((e: Error) => {
              console.error(e);
              throw new Error(`Update tax category error`);
            });
        }

        const [[business], _taxCategory] = await Promise.all([
          insertBusinessPromise,
          taxCategoryPromise,
        ]);

        return { ...financialEntity, ...business };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: `Failed to create business`,
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
    exemptDealer: DbBusiness => DbBusiness.exempt_dealer,
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
  CreditcardBankCharge: commonChargeFields,
};
