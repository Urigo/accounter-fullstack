import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Currency, DocumentInput_Input } from '@accounter/green-invoice-graphql';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { DEFAULT_FINANCIAL_ENTITY_ID, UUID_REGEX } from '@shared/constants';
import { Resolvers } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { filterBusinessByName } from '../helpers/utils.helper.js';
import { BusinessesGreenInvoiceMatcherProvider } from '../providers/businesses-green-invoice-match.provider.js';
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

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>>;
}[keyof T];

type Tag = RequireAtLeastOne<{
  name: string;
  id: string;
}>;

type TEMP = {
  businessId: string;
  amount: number;
  currency: Currency;
};

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

      let suggestionData: IUpdateBusinessParams['suggestionData'] = null;
      if (fields.suggestions) {
        const currentBusiness = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(businessId);
        if (!currentBusiness) {
          return {
            __typename: 'CommonError',
            message: `Business ID="${businessId}" not found`,
          };
        }
        if (
          currentBusiness.suggestion_data &&
          typeof currentBusiness.suggestion_data === 'object'
        ) {
          const tags = fields.suggestions.tags
            ? fields.suggestions.tags.map(tag => tag.id)
            : 'tags' in currentBusiness.suggestion_data
              ? (currentBusiness.suggestion_data.tags as Tag[]).map(tag =>
                  'id' in tag ? tag.id : tag.name,
                )
              : undefined;
          const phrases =
            fields.suggestions.phrases ??
            ('phrases' in currentBusiness.suggestion_data
              ? (currentBusiness.suggestion_data.phrases as string[])
              : undefined);
          const description =
            fields.suggestions.description ??
            ('description' in currentBusiness.suggestion_data
              ? (currentBusiness.suggestion_data.description as string)
              : undefined);
          suggestionData = {
            tags,
            phrases,
            description,
          } as unknown as Json;
        } else {
          suggestionData = {
            tags: fields.suggestions.tags?.map(tag => tag.id),
            phrases: fields.suggestions.phrases?.map(phrase => phrase),
            description: fields.suggestions.description ?? undefined,
          } as Json;
        }
      }
      const adjustedFields: IUpdateBusinessParams = {
        address: fields.address,
        email: fields.email,
        exemptDealer: fields.exemptDealer,
        vatNumber: fields.governmentId,
        hebrewName: fields.hebrewName,
        phoneNumber: fields.phoneNumber,
        website: fields.website,
        optionalVat: fields.optionalVAT,
        businessId,
        suggestionData,
      };
      try {
        if (
          fields.hebrewName ||
          fields.address ||
          fields.email ||
          fields.governmentId ||
          fields.phoneNumber ||
          fields.website ||
          fields.exemptDealer != null ||
          fields.suggestions ||
          fields.optionalVAT != null
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
          optionalVat: fields.optionalVAT,
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
    generateMonthlyProformaDocuments: async (_, __, { injector }) => {
      const jsonArray: Array<TEMP> = [
        {
          businessId: '147d3415-55e3-497f-acba-352dcc37cb8d', // uri test
          amount: 1000,
          currency: 'ILS',
        },
      ];

      const errors: string[] = [];

      const proformaProtos = await Promise.all(
        jsonArray.map(async json => {
          const businessPromise = injector
            .get(BusinessesProvider)
            .getBusinessByIdLoader.load(json.businessId);
          const businessGreenInvoiceMatchPromise = injector
            .get(BusinessesGreenInvoiceMatcherProvider)
            .getBusinessMatchByIdLoader.load(json.businessId);
          const [business, businessGreenInvoiceMatch] = await Promise.all([
            businessPromise,
            businessGreenInvoiceMatchPromise,
          ]);

          if (!business) {
            throw new GraphQLError(`Business ID="${json.businessId}" not found`);
          }

          if (!businessGreenInvoiceMatch) {
            throw new GraphQLError(
              `Green invoice match not found for business ID="${json.businessId}"`,
            );
          }

          const today = new Date();
          const monthStart = dateToTimelessDateString(startOfMonth(today));
          const monthEnd = dateToTimelessDateString(endOfMonth(today));
          const year = today.getFullYear();
          const month = format(subMonths(today, 1), 'MMMM');

          const documentInput: DocumentInput_Input & { businessName: string } = {
            businessName: business.name,
            type: '_300',
            remarks: businessGreenInvoiceMatch.remark ?? undefined,
            date: monthStart,
            dueDate: monthEnd,
            lang: 'en',
            currency: json.currency,
            vatType: 1,
            rounding: false,
            signed: true,
            attachment: true,
            client: {
              id: businessGreenInvoiceMatch.green_invoice_id,
              emails: [...(businessGreenInvoiceMatch.emails ?? []), 'uri@the-guild.dev'],
            },
            income: [
              {
                description: `GraphQL Hive Enterprise License - ${month} ${year}`,
                quantity: 1,
                price: json.amount,
                currency: json.currency,
                vatType: 1,
              },
            ],
          };

          return documentInput;
        }),
      );

      for (const proformaProto of proformaProtos) {
        const { businessName, ...input } = proformaProto;
        await injector
          .get(GreenInvoiceProvider)
          .addDocuments({ input })
          .catch(e => {
            console.error(e);
            errors.push(`${businessName}: ${e.message}`);
          });
      }

      return {
        success: true,
        errors,
      };
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
    suggestions: (DbBusiness, _, { injector }) => {
      if (DbBusiness.suggestion_data && typeof DbBusiness.suggestion_data === 'object') {
        return {
          tags:
            'tags' in DbBusiness.suggestion_data
              ? (DbBusiness.suggestion_data.tags as string[]).map(suggestedTag =>
                  (UUID_REGEX.test(suggestedTag)
                    ? injector.get(TagsProvider).getTagByIDLoader.load(suggestedTag)
                    : injector.get(TagsProvider).getTagByNameLoader.load(suggestedTag)
                  )
                    .then(tag => {
                      if (!tag) {
                        throw new GraphQLError(`Tag "${suggestedTag}" not found`);
                      }
                      return tag;
                    })
                    .catch(e => {
                      console.error(e);
                      throw new GraphQLError(`Failed to load tag "${suggestedTag}"`);
                    }),
                )
              : [],
          phrases:
            'phrases' in DbBusiness.suggestion_data
              ? (DbBusiness.suggestion_data.phrases as string[])
              : [],
          description:
            'description' in DbBusiness.suggestion_data
              ? (DbBusiness.suggestion_data.description as string)
              : null,
        };
      }
      return null;
    },
    optionalVAT: DbBusiness => DbBusiness.optional_vat,
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
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
};
