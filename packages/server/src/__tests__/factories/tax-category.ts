import { makeUUIDLegacy } from '../../demo-fixtures/helpers/deterministic-uuid.js';
import { FixtureTaxCategories } from '../helpers/fixture-types.js';

/**
 * Tax category factory for test fixtures
 *
 * Creates a minimal tax category object ready for insertion via pgtyped.
 *
 * @param overrides - Optional overrides for any tax category field
 * @returns Tax category object matching IInsertTaxCategoryParams shape
 *
 * @remarks
 * - id defaults to deterministic UUID if not provided
 * - name defaults to overrides.id ?? defaultId (intelligent fallback for display)
 * - hashavshevetName defaults to null (not integrated with Hashavshevet)
 * - taxExcluded defaults to false (most categories include tax)
 *
 * @example
 * ```typescript
 * // Minimal tax category
 * const category = createTaxCategory({ id: makeUUID('tax-category', 'expense-general') });
 *
 * // Tax category with Hashavshevet integration
 * const integrated = createTaxCategory({
 *   id: makeUUID('tax-category', 'expense-office'),
 *   hashavshevetName: 'משרדיות',
 * });
 *
 * // Tax-excluded category
 * const excluded = createTaxCategory({
 *   id: makeUUID('tax-category', 'income-exempt'),
 *   taxExcluded: true,
 * });
 * ```
 */
export function createTaxCategory(
  overrides?: Partial<FixtureTaxCategories['taxCategories'][number]>,
): FixtureTaxCategories['taxCategories'][number] {
  const defaultId = makeUUIDLegacy();
  return {
    id: defaultId,
    // Intelligent name defaulting: use provided id, or use generated UUID
    // This ensures display name is always meaningful even when only id is specified
    name: overrides?.id ?? defaultId,
    hashavshevetName: null,
    taxExcluded: false,
    ...overrides,
  };
}
