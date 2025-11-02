import { GraphQLError } from 'graphql';
import {
  SuggestionData,
  suggestionDataSchema,
} from '@modules/financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { updateGreenInvoiceClient } from '@modules/green-invoice/helpers/green-invoice-clients.helper.js';
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
          totalRecords: filteredBusinesses.length,
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
          isActive: fields.isActive ?? null,
        });
      }

      let suggestionData: SuggestionData | null = null;
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
        isReceiptEnough: fields.isReceiptEnough ?? null,
        isDocumentsOptional: fields.isDocumentsOptional ?? null,
        country: fields.country,
        suggestionData,
        pcn874RecordTypeOverride: fields.pcn874RecordType,
      };

      let updatedBusiness: IGetBusinessesByIdsResult | undefined = undefined;

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
              const message = `Error updating business ID="${businessId}"`;
              console.error(`${message}: ${e}`);
              if (e instanceof GraphQLError) {
                throw e;
              }
              throw new Error(message);
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
                const message = `Error updating tax category for business ID="${businessId}"`;
                console.error(`${message}: ${e}`);
                throw new Error(message);
              });
          }
        }

        updatedBusiness = await injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(businessId);
        if (!updatedBusiness) {
          throw new Error(`Updated business not found`);
        }
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update business ID="${businessId}": ${(e as Error).message}`,
        };
      }

      // update green invoice client if needed
      await updateGreenInvoiceClient(businessId, injector, fields);

      return updatedBusiness;
    },
    insertNewBusiness: async (
      _,
      { fields },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        if (!fields.country) {
          throw new GraphQLError(`Country is required to create a new business`);
        }

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
            isActive: fields.isActive ?? true,
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

        const suggestions: SuggestionData | undefined = fields.suggestions
          ? {
              tags: fields.suggestions.tags?.map(tag => tag.id),
              phrases: fields.suggestions.phrases?.map(phrase => phrase),
              description: fields.suggestions.description ?? undefined,
              emails: fields.suggestions.emails ? [...fields.suggestions.emails] : undefined,
              emailListener: fields.suggestions.emailListener
                ? {
                    ...fields.suggestions.emailListener,
                    internalEmailLinks: fields.suggestions.emailListener.internalEmailLinks
                      ? [...fields.suggestions.emailListener.internalEmailLinks]
                      : undefined,
                    emailBody: fields.suggestions.emailListener.emailBody ?? undefined,
                    attachments: fields.suggestions.emailListener.attachments
                      ? [...fields.suggestions.emailListener.attachments]
                      : undefined,
                  }
                : undefined,
              priority: fields.suggestions.priority ?? undefined,
            }
          : undefined;

        const business = await injector.get(BusinessesProvider).insertBusinessLoader.load({
          id: financialEntity.id,
          address: fields.address,
          email: fields.email,
          exemptDealer: fields.exemptDealer ?? false,
          governmentId: fields.governmentId,
          hebrewName: fields.hebrewName,
          phoneNumber: fields.phoneNumber,
          website: fields.website,
          optionalVat: fields.optionalVAT ?? false,
          isReceiptEnough: fields.isReceiptEnough ?? false,
          isDocumentsOptional: fields.isDocumentsOptional ?? false,
          country: fields.country,
          suggestions,
          pcn874RecordTypeOverride: fields.pcn874RecordType,
        });

        if (!business) {
          throw new Error(`Failed to create core business`);
        }

        if (fields.taxCategory) {
          const taxCategoryParams: IUpdateBusinessTaxCategoryParams = {
            businessId: financialEntity.id,
            ownerId: defaultAdminBusinessId,
            taxCategoryId: fields.taxCategory,
          };
          await injector
            .get(TaxCategoriesProvider)
            .insertBusinessTaxCategory(taxCategoryParams)
            .then(res => res[0])
            .catch((e: Error) => {
              const message = `Error updating tax category for business ID="${financialEntity.id}"`;
              console.error(`${message}: ${e}`);
              throw new Error(message);
            });
        }

        return {
          ...financialEntity,
          ...business,
        };
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
        let suggestionData: SuggestionData | null = null;

        const {
          data: targetSuggestionData,
          error,
          success,
        } = suggestionDataSchema.safeParse(targetBusiness.suggestion_data);
        if (success) {
          suggestionData = targetSuggestionData;
        } else {
          console.error('Failed to parse suggestion data for business', {
            businessId: targetBusiness.id,
            error,
          });
          throw new GraphQLError('Failed to parse suggestion data for target business');
        }

        for (const businessToMerge of businessesToMerge) {
          if (!businessToMerge || businessToMerge instanceof Error) {
            continue;
          }
          const { data: mergedBusinessSuggestionData, success } = suggestionDataSchema.safeParse(
            businessToMerge.suggestion_data,
          );
          if (success && mergedBusinessSuggestionData.phrases) {
            suggestionData = updateSuggestions(
              { phrases: mergedBusinessSuggestionData.phrases },
              suggestionData,
              true,
            );
          }
        }
        if (suggestionData) {
          await injector.get(BusinessesProvider).updateBusiness({
            businessId: targetBusinessId,
            suggestionData,
          });
        }

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
      { injector, adminContext: { defaultAdminBusinessId, locality } },
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
        const { data: suggestionData, success } = suggestionDataSchema.safeParse(
          business.suggestion_data,
        );
        if (!success || !suggestionData.phrases) {
          return;
        }
        suggestionData.phrases.map(phrase => {
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
              isActive: true,
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

          const business = await injector.get(BusinessesProvider).insertBusinessLoader.load({
            id: financialEntity.id,
            country: locality,
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
            isReceiptEnough: false,
            isDocumentsOptional: false,
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
      const { data: suggestionData, success } = suggestionDataSchema.safeParse(
        DbBusiness.suggestion_data,
      );
      if (success) {
        return {
          tags: suggestionData.tags
            ? suggestionData.tags.map(suggestedTag =>
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
          phrases: suggestionData.phrases ?? [],
          description: suggestionData.description ?? null,
          emails: suggestionData.emails ?? [],
          emailListener: suggestionData.emailListener ?? null,
          priority: suggestionData.priority ?? null,
        };
      }
      return null;
    },
    optionalVAT: DbBusiness => DbBusiness.optional_vat,
    pcn874RecordType: DbBusiness => DbBusiness.pcn874_record_type_override,
    isReceiptEnough: DbBusiness => DbBusiness.can_settle_with_receipt,
    isDocumentsOptional: DbBusiness => DbBusiness.no_invoices_required,
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
