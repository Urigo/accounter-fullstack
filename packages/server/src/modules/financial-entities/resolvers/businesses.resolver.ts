import { GraphQLError } from 'graphql';
import { SortCodesProvider } from '@modules/sort-codes/providers/sort-codes.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { UUID_REGEX } from '@shared/constants';
import { Resolvers } from '@shared/gql-types';
import { updateSuggestions } from '../helpers/businesses.helper.js';
import { hasFinancialEntitiesCoreProperties } from '../helpers/financial-entities.helper.js';
import { filterBusinessByName } from '../helpers/utils.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  FinancialEntitiesModule,
  IGetBusinessesByIdsResult,
  IInsertBusinessesParams,
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
        throw new Error(`Business ID="${id}" not found`);
      }

      return dbFe;
    },
    businesses: async (_, { ids }, { injector }) => {
      const businesses = await injector.get(BusinessesProvider).getBusinessByIdLoader.loadMany(ids);
      if (businesses.some(business => !business || business instanceof Error)) {
        throw new Error(`Error fetching some of the businesses`);
      }

      return businesses as IGetBusinessesByIdsResult[];
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
        await injector.get(FinancialEntitiesProvider).updateFinancialEntity({
          ...fields,
          financialEntityId: businessId,
          irsCode: fields.irsCode ?? null,
        });
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
        suggestionData = updateSuggestions(fields.suggestions, currentBusiness.suggestion_data);
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
        country: fields.country,
        suggestionData,
        pcn874RecordTypeOverride: fields.pcn874RecordType,
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
          fields.optionalVAT != null ||
          fields.pcn874RecordType
        ) {
          await injector
            .get(BusinessesProvider)
            .updateBusiness({ ...adjustedFields, businessId })
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
            console.error(error);
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
    insertNewBusiness: async (
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
            type: 'business',
            irsCode,
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

        const suggestions: IInsertBusinessesParams['businesses'][number]['suggestions'] =
          fields.suggestions
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
          country: fields.country,
          suggestions,
          pcn874RecordTypeOverride: fields.pcn874RecordType,
        });

        let taxCategoryPromise: Promise<IInsertBusinessTaxCategoryResult | void> =
          Promise.resolve();
        if (fields.taxCategory) {
          const texCategoryParams: IUpdateBusinessTaxCategoryParams = {
            businessId: financialEntity.id,
            ownerId: defaultAdminBusinessId,
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
    mergeBusinesses: async (_, { targetBusinessId, businessIdsToMerge }, { injector }) => {
      try {
        const [targetBusiness, ...businessesToMerge] = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.loadMany([targetBusinessId, ...businessIdsToMerge]);
        if (!targetBusiness || targetBusiness instanceof Error) {
          throw new GraphQLError(`Target business not found`);
        }

        const mergeBusinessPromises = businessIdsToMerge.map(businessIdToMerge =>
          injector
            .get(FinancialEntitiesProvider)
            .replaceFinancialEntity(targetBusinessId, businessIdToMerge, true),
        );
        await Promise.all(mergeBusinessPromises);

        // handle suggestions
        let suggestionData = targetBusiness.suggestion_data;
        for (const businessToMerge of businessesToMerge) {
          if (!businessToMerge || businessToMerge instanceof Error) {
            continue;
          }
          if (
            businessToMerge.suggestion_data &&
            typeof businessToMerge.suggestion_data === 'object' &&
            'phrases' in businessToMerge.suggestion_data
          ) {
            suggestionData = updateSuggestions(
              { phrases: businessToMerge.suggestion_data['phrases'] as string[] },
              suggestionData,
              true,
            );
          }
        }
        await injector.get(BusinessesProvider).updateBusiness({
          businessId: targetBusinessId,
          suggestionData,
        });

        // refetch updated target business
        const updatedBusiness = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(targetBusinessId);
        if (!updatedBusiness || updatedBusiness instanceof Error) {
          throw new GraphQLError(`Target business not found`);
        }
        return updatedBusiness;
      } catch (e) {
        console.error(e);
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new GraphQLError(`Failed to merge businesses`);
      }
    },
    batchGenerateBusinessesOutOfTransactions: async (
      _,
      __,
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const transactionsPromise = injector.get(TransactionsProvider).getTransactionsByFilters({
        ownerIDs: [defaultAdminBusinessId],
      });
      const businessesPromise = injector.get(BusinessesProvider).getAllBusinesses();
      const [transactions, businesses] = await Promise.all([
        transactionsPromise,
        businessesPromise,
      ]);

      const businessIdsPerDescription = new Map<string, Set<string>>();
      transactions.map(transaction => {
        if (!transaction.source_description) {
          return;
        }
        const description = transaction.source_description.toLowerCase();
        if (!businessIdsPerDescription.has(description)) {
          businessIdsPerDescription.set(description, new Set());
        }
        if (transaction.business_id) {
          businessIdsPerDescription.get(description)?.add(transaction.business_id);
        }
      });
      businesses.map(business => {
        if (
          !business.suggestion_data ||
          typeof business.suggestion_data !== 'object' ||
          !('phrases' in business.suggestion_data)
        ) {
          return;
        }
        const phrases = business.suggestion_data.phrases as string[];
        phrases.map(phrase => {
          const description = phrase.toLowerCase();
          if (!businessIdsPerDescription.has(description)) {
            businessIdsPerDescription.set(description, new Set());
          }
          businessIdsPerDescription.get(description)?.add(business.id);
        });
      });

      const descriptionBusinessPairs: [string, string][] = [];
      const multipleMatchesDescriptions: [string, string[]][] = [];
      const nonMatchesDescriptions: string[] = [];

      Array.from(businessIdsPerDescription.entries()).map(async ([description, businessIds]) => {
        if (businessIds.size === 1) {
          descriptionBusinessPairs.push([description, businessIds.values().next().value!]);
          return;
        }

        if (businessIds.size > 1) {
          multipleMatchesDescriptions.push([description, Array.from(businessIds.values())]);
          return;
        }

        nonMatchesDescriptions.push(description);
      });

      console.log(
        'Multiple matches descriptions:',
        multipleMatchesDescriptions
          .map(([description, businessIDs]) => `\n  "${description}": ${businessIDs.join(', ')}`)
          .join(''),
      );

      const uniqueDescriptions = Array.from(new Set<string>(nonMatchesDescriptions)).sort();

      const businessTransactions = new Map<string, string[]>();

      transactions.map(t => {
        if (!t.business_id && t.source_description) {
          const businessId = descriptionBusinessPairs.find(
            pair => pair[0] === t.source_description,
          );
          if (businessId) {
            if (!businessTransactions.has(businessId[1])) {
              businessTransactions.set(businessId[1], []);
            }
            businessTransactions.get(businessId[1])?.push(t.id);
          }
        }
      });

      Array.from(businessTransactions.entries())
        .map(([businessId, transactionIds]) =>
          transactionIds.map(transactionId =>
            injector.get(TransactionsProvider).updateTransactions({
              businessId,
              transactionIds: [transactionId],
            }),
          ),
        )
        .flat();

      const newBusinessesIds = await Promise.all(
        uniqueDescriptions.map(async description => {
          const financialEntity = await injector
            .get(FinancialEntitiesProvider)
            .insertFinancialEntitiesLoader.load({
              ownerId: defaultAdminBusinessId,
              name: description,
              type: 'business',
              sortCode: null,
              irsCode: null,
            })
            .catch((e: Error) => {
              console.error(e);
              return null;
            });

          if (!financialEntity) {
            throw new Error(
              `Failed to create core financial entity for description "${description}"`,
            );
          }

          const business = await injector.get(BusinessesProvider).insertBusinessesLoader.load({
            id: financialEntity.id,
            country: 'Israel',
            hebrewName: description,
            suggestions: {
              phrases: [description],
            },
            address: undefined,
            email: undefined,
            website: undefined,
            phoneNumber: undefined,
            governmentId: undefined,
            exemptDealer: false,
            optionalVat: false,
            pcn874RecordTypeOverride: null,
          });

          if (!business) {
            throw new Error(`Failed to create business for description "${description}"`);
          }

          return business.id;
        }),
      );

      return injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.loadMany(newBusinessesIds) as Promise<IGetBusinessesByIdsResult[]>;
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
    country: DbBusiness => DbBusiness.country,
    governmentId: DbBusiness => DbBusiness.vat_number,
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
    pcn874RecordType: DbBusiness => DbBusiness.pcn874_record_type_override,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
    pcn874RecordType: DbBusiness => DbBusiness.pcn874_record_type_override,
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
  ForeignSecuritiesCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
};
