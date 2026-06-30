import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { UpdateBusinessInput } from '../../../__generated__/types.js';
import { updateGreenInvoiceClient } from '../../green-invoice/helpers/green-invoice-clients.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type {
  IGetBusinessesByIdsResult,
  IUpdateBusinessParams,
  IUpdateBusinessTaxCategoryParams,
} from '../types.js';
import type { SuggestionData } from './business-suggestion-data-schema.helper.js';
import { updateSuggestions } from './businesses.helper.js';
import { hasFinancialEntitiesCoreProperties } from './financial-entities.helper.js';

/**
 * Update a single business' core financial-entity fields, business fields, suggestions and
 * tax-category match, then sync the green-invoice client. Throws on failure; returns the
 * refreshed business on success. Shared by the `updateBusiness` and `batchUpdateBusinesses`
 * mutations.
 */
export async function updateSingleBusiness(
  injector: Injector,
  businessId: string,
  ownerId: string,
  fields: UpdateBusinessInput,
): Promise<IGetBusinessesByIdsResult> {
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
      throw new GraphQLError(`Business ID="${businessId}" not found`);
    }
    suggestionData = updateSuggestions(fields.suggestions, currentBusiness.suggestion_data);
  }

  const adjustedFields: IUpdateBusinessParams = {
    address: fields.address,
    city: fields.city,
    zipCode: fields.zipCode,
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

  if (Object.values(adjustedFields).some(field => field != null)) {
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
    const taxCategoryParams: IUpdateBusinessTaxCategoryParams = {
      businessId,
      ownerId,
      taxCategoryId: fields.taxCategory,
    };
    const taxCategoriesProvider = injector.get(TaxCategoriesProvider);
    const taxCategoryMatchLoader = taxCategoriesProvider.taxCategoryByBusinessIDsLoader;
    // check whether a match already exists rather than insert-then-catch-update, which
    // would log false-positive errors and (inside a transaction) abort it on conflict
    const existingTaxCategory = await taxCategoryMatchLoader.load(businessId);
    if (existingTaxCategory) {
      await taxCategoriesProvider.updateBusinessTaxCategory(taxCategoryParams).catch((e: Error) => {
        const message = `Error updating tax category for business ID="${businessId}"`;
        console.error(`${message}: ${e}`);
        throw new Error(message);
      });
    } else {
      await taxCategoriesProvider.insertBusinessTaxCategory(taxCategoryParams).catch((e: Error) => {
        const message = `Error inserting tax category for business ID="${businessId}"`;
        console.error(`${message}: ${e}`);
        throw new Error(message);
      });
    }
  }

  const updatedBusiness = await injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(businessId);
  if (!updatedBusiness) {
    throw new Error(`Updated business not found`);
  }

  // update green invoice client if needed
  await updateGreenInvoiceClient(businessId, injector, fields);

  return updatedBusiness;
}
