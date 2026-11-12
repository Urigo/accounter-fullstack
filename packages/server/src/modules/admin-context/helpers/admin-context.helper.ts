import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import type {
  IGetAllTaxCategoriesResult,
  IGetBusinessesByIdsResult,
} from '../../financial-entities/types.js';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';
import { AdminContextProvider } from '../providers/admin-context.provider.js';
import {
  securitiesTaxCategoryLabel,
  type SecuritiesContextPatch,
} from './securities-context.helper.js';

export function fetchTaxCategory(
  injector: Injector,
  fieldName: string,
  id?: string | null,
): Promise<IGetAllTaxCategoriesResult> {
  const name = fieldName.replace('TaxCategory', '');
  if (!id) {
    throw new GraphQLError(`${name} tax category ID is not set`);
  }
  return injector
    .get(TaxCategoriesProvider)
    .taxCategoryByIdLoader.load(id)
    .then(res => {
      if (!res) {
        throw new GraphQLError(`Tax category ${name} (with ID="${id}") not found`);
      }
      return res;
    })
    .catch(e => {
      if (e instanceof GraphQLError) {
        throw e;
      }
      console.error(JSON.stringify(e, null, 2));
      throw new GraphQLError(`Error fetching tax category`);
    });
}
export function fetchBusiness(
  injector: Injector,
  fieldName: string,
  id?: string | null,
): Promise<IGetBusinessesByIdsResult> {
  const name = fieldName.replace('Business', '');
  if (!id) {
    throw new GraphQLError(`${name} business ID is not set`);
  }
  return injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(id)
    .then(res => {
      if (!res) {
        throw new GraphQLError(`Business ${name} (with ID="${id}") not found`);
      }
      return res;
    })
    .catch(e => {
      if (e instanceof GraphQLError) {
        throw e;
      }
      console.error(JSON.stringify(e, null, 2));
      throw new GraphQLError(`Error fetching business`);
    });
}

/**
 * `securities_context` is jsonb and carries no foreign keys, so a change to it is checked here
 * before it is stored: every tax category and the foreign-securities business must belong to the
 * business being configured — not merely be readable, which in a multi-business scope spans other
 * businesses too — and the sort code must be one of its sort codes.
 */
export async function validateSecuritiesContextPatch(
  injector: Injector,
  patch: SecuritiesContextPatch,
): Promise<void> {
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  const assignments = (patch.taxCategories ?? []).filter(
    (assignment): assignment is { key: typeof assignment.key; taxCategoryId: string } =>
      !!assignment.taxCategoryId,
  );
  const taxCategories = await Promise.all(
    assignments.map(({ taxCategoryId }) =>
      injector.get(TaxCategoriesProvider).taxCategoryByIdLoader.load(taxCategoryId),
    ),
  );
  const unknown = assignments.filter((_, index) => taxCategories[index]?.owner_id !== ownerId);
  if (unknown.length) {
    throw new GraphQLError(
      `Tax category not found in this business: ${unknown
        .map(
          ({ key, taxCategoryId }) => `${securitiesTaxCategoryLabel(key)} (ID="${taxCategoryId}")`,
        )
        .join(', ')}`,
    );
  }

  if (patch.foreignSecuritiesBusinessId) {
    const business = await injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(patch.foreignSecuritiesBusinessId);
    if (business?.owner_id !== ownerId) {
      throw new GraphQLError(
        `Foreign securities business not found in this business: ID="${patch.foreignSecuritiesBusinessId}"`,
      );
    }
  }

  if (patch.sortCode != null) {
    const sortCode = await injector
      .get(SortCodesProvider)
      .getSortCodesByIdLoader.load({ key: patch.sortCode, ownerId });
    if (!sortCode) {
      throw new GraphQLError(`Sort code ${patch.sortCode} not found`);
    }
  }
}
