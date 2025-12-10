import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import type {
  IGetAllTaxCategoriesResult,
  IGetBusinessesByIdsResult,
} from '../../financial-entities/types.js';

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
