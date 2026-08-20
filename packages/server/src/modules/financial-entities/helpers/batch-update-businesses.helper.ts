import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { BatchUpdateBusinessInput } from '../../../__generated__/types.js';
import { updateGreenInvoiceClient } from '../../green-invoice/helpers/green-invoice-clients.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
import { ClientsProvider } from '../providers/clients.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../providers/tax-categories.provider.js';
import type { IGetBusinessesByIdsResult } from '../types.js';

/**
 * Reload the given businesses after a batch write and return them in the requested order.
 *
 * The batch statements each `RETURNING *` only their own table, while a `Business` is the join of
 * `businesses` and `financial_entities` — so read them back through the (batching) id loader, which
 * the providers just invalidated. One query for the whole selection.
 */
async function reloadBusinesses(
  injector: Injector,
  businessIds: readonly string[],
): Promise<IGetBusinessesByIdsResult[]> {
  const businesses = await injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.loadMany(businessIds);
  return businesses.map((business, index) => {
    if (!business || business instanceof Error) {
      throw new GraphQLError(`Business ID="${businessIds[index]}" not found`);
    }
    return business;
  });
}

/**
 * Push the batch's field changes to Green Invoice for whichever of the businesses are linked
 * clients. `updateGreenInvoiceClient` bails out for businesses with no Green Invoice id, so this is
 * a no-op for the common case.
 *
 * The calls stay sequential: they hit an external API that is not covered by the DB mutex, and a
 * failure mid-batch should stop rather than fan out more partial writes. Both loaders they read from
 * are primed first, so the DB side still costs two queries total rather than two per business.
 */
async function syncGreenInvoiceClients(
  injector: Injector,
  businessIds: readonly string[],
  fields: BatchUpdateBusinessInput,
): Promise<void> {
  await Promise.all([
    injector.get(BusinessesProvider).getBusinessByIdLoader.loadMany(businessIds),
    injector.get(ClientsProvider).getClientByIdLoader.loadMany(businessIds),
  ]);
  for (const businessId of businessIds) {
    await updateGreenInvoiceClient(businessId, injector, fields);
  }
}

/**
 * Apply one set of field values to many businesses.
 *
 * Every touched table gets a single statement for the whole selection, so the cost is a small fixed
 * number of queries regardless of how many businesses were selected:
 * - `businesses` (locality, flags, suggestion description) — one `batchUpdateBusinesses`
 * - `financial_entities` (sort code, IRS code, active) — one `batchUpdateFinancialEntities`
 * - `business_tax_category_match` (tax category) — one upsert
 * plus one read to return the refreshed rows.
 *
 * Only the fields present in `fields` are written; the statements `COALESCE` every column against
 * itself, so an absent field leaves each business's own value alone.
 */
export async function applyBatchBusinessUpdate(
  injector: Injector,
  businessIds: readonly string[],
  ownerId: string,
  fields: BatchUpdateBusinessInput,
): Promise<IGetBusinessesByIdsResult[]> {
  const ids = [...new Set(businessIds)];
  if (ids.length === 0) {
    return [];
  }

  const businessFields = {
    city: fields.city,
    zipCode: fields.zipCode,
    country: fields.country,
    isDocumentsOptional: fields.isDocumentsOptional,
    isReceiptEnough: fields.isReceiptEnough,
    exemptDealer: fields.exemptDealer,
    optionalVat: fields.optionalVAT,
    pcn874RecordTypeOverride: fields.pcn874RecordType,
    suggestionDescription: fields.suggestionDescription,
  };
  const financialEntityFields = {
    sortCode: fields.sortCode,
    irsCode: fields.irsCode,
    isActive: fields.isActive,
  };

  const writes: Promise<unknown>[] = [];

  if (Object.values(businessFields).some(value => value != null)) {
    writes.push(
      injector
        .get(BusinessesProvider)
        .batchUpdateBusinesses({ ...businessFields, businessIds: ids })
        .catch((e: Error) => {
          console.error(`Error batch updating businesses: ${e}`);
          throw new GraphQLError(`Error updating ${ids.length} businesses`);
        }),
    );
  }

  if (Object.values(financialEntityFields).some(value => value != null)) {
    writes.push(
      injector
        .get(FinancialEntitiesProvider)
        .batchUpdateFinancialEntities({ ...financialEntityFields, financialEntityIds: ids })
        .catch((e: Error) => {
          console.error(`Error batch updating financial entities: ${e}`);
          throw new GraphQLError(`Error updating ${ids.length} businesses`);
        }),
    );
  }

  if (fields.taxCategory) {
    writes.push(
      injector
        .get(TaxCategoriesProvider)
        .batchUpsertBusinessesTaxCategory({
          businessIds: ids,
          ownerId,
          taxCategoryId: fields.taxCategory,
        })
        .catch((e: Error) => {
          console.error(`Error batch updating businesses tax category: ${e}`);
          throw new GraphQLError(`Error updating tax category for ${ids.length} businesses`);
        }),
    );
  }

  // Distinct tables, so the statements don't contend with each other.
  await Promise.all(writes);

  const updatedBusinesses = await reloadBusinesses(injector, ids);
  await syncGreenInvoiceClients(injector, ids, fields);

  return updatedBusinesses;
}

/**
 * Add and/or remove suggestion tags across many businesses, leaving each business's other tags
 * untouched. Mirrors the charges-side `applyChargeTagChanges`, but business suggestion tags live
 * inside the `suggestion_data` JSON blob rather than a join table, so the whole selection is handled
 * by one statement (the set arithmetic runs in SQL). An id passed in both lists ends up added.
 */
export async function applyBatchBusinessTagChanges(
  injector: Injector,
  businessIds: readonly string[],
  addTagIds: readonly string[],
  removeTagIds: readonly string[],
): Promise<IGetBusinessesByIdsResult[]> {
  const ids = [...new Set(businessIds)];
  if (ids.length === 0) {
    return [];
  }
  if (addTagIds.length === 0 && removeTagIds.length === 0) {
    return reloadBusinesses(injector, ids);
  }

  await injector
    .get(BusinessesProvider)
    .batchUpdateBusinessesSuggestionTags({
      businessIds: ids,
      addTagIds: [...addTagIds],
      removeTagIds: [...removeTagIds],
    })
    .catch((e: Error) => {
      console.error(`Error batch updating businesses tags: ${e}`);
      throw new GraphQLError(`Error updating tags for ${ids.length} businesses`);
    });

  return reloadBusinesses(injector, ids);
}
