import type { IInsertTaxCategoryParams } from '../../modules/financial-entities/__generated__/tax-categories.types.js';
import { makeUUID } from './ids.js';

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
 * - hashavshevetName defaults to null (not integrated with Hashavshevet)
 * - taxExcluded defaults to false (most categories include tax)
 *
 * @example
 * ```typescript
 * // Minimal tax category
 * const category = createTaxCategory({ id: makeUUID('expense-general') });
 *
 * // Tax category with Hashavshevet integration
 * const integrated = createTaxCategory({
 *   id: makeUUID('expense-office'),
 *   hashavshevetName: 'משרדיות',
 * });
 *
 * // Tax-excluded category
 * const excluded = createTaxCategory({
 *   id: makeUUID('income-exempt'),
 *   taxExcluded: true,
 * });
 * ```
 */
export function createTaxCategory(
  overrides?: Partial<IInsertTaxCategoryParams>,
): IInsertTaxCategoryParams {
  return {
    id: makeUUID(),
    hashavshevetName: null,
    taxExcluded: false,
    ...overrides,
  };
}
