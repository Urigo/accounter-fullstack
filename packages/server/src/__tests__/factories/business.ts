import type { IInsertBusinessesParams } from '@modules/financial-entities/__generated__/businesses.types.js';
import { makeUUID } from './ids.js';

/**
 * Business factory for test fixtures
 *
 * Creates a minimal business object ready for insertion via pgtyped.
 *
 * @param overrides - Optional overrides for any business field
 * @returns Business object matching IInsertBusinessesParams.businesses[0] shape
 *
 * @remarks
 * - id defaults to deterministic UUID if not provided
 * - All other fields default to null/void (database will use defaults or accept nulls)
 * - exemptDealer defaults to false for typical scenarios
 * - isReceiptEnough defaults to false (invoices required by default)
 * - isDocumentsOptional defaults to false (documents required by default)
 *
 * @example
 * ```typescript
 * // Minimal business (uses defaults)
 * const business = createBusiness({ id: makeUUID('supplier-1') });
 *
 * // Business with custom fields
 * const supplier = createBusiness({
 *   id: makeUUID('supplier-usd'),
 *   hebrewName: 'ספק אמריקאי',
 *   country: 'USA',
 *   isReceiptEnough: true,
 * });
 * ```
 */
export function createBusiness(
  overrides?: Partial<IInsertBusinessesParams['businesses'][number]>,
): IInsertBusinessesParams['businesses'][number] {
  return {
    id: makeUUID(),
    hebrewName: null,
    address: null,
    email: null,
    website: null,
    phoneNumber: null,
    governmentId: null,
    exemptDealer: false,
    suggestions: null,
    optionalVat: false, // Database requires NOT NULL
    country: 'ISR', // Database requires NOT NULL, default to Israel
    pcn874RecordTypeOverride: null,
    isReceiptEnough: false,
    isDocumentsOptional: false,
    ...overrides,
  };
}
