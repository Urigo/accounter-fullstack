import { makeUUIDLegacy } from '../../demo-fixtures/helpers/deterministic-uuid.js';
import { CountryCode } from '../../modules/countries/types.js';
import { FixtureBusinesses } from '__tests__/helpers/fixture-types.js';

/**
 * Business factory for test fixtures
 *
 * Creates a minimal business object ready for insertion via pgtyped.
 *
 * @param overrides - Optional overrides for any business field
 * @returns Business object matching FixtureBusinesses['businesses'][0] shape
 *
 * @remarks
 * - id defaults to deterministic UUID if not provided
 * - name defaults to overrides.id ?? defaultId (intelligent fallback for display)
 * - All other fields default to null/void (database will use defaults or accept nulls)
 * - exemptDealer defaults to false for typical scenarios
 * - isReceiptEnough defaults to false (invoices required by default)
 * - isDocumentsOptional defaults to false (documents required by default)
 *
 * @example
 * ```typescript
 * // Minimal business (uses defaults)
 * const business = createBusiness({ id: makeUUID('business', 'supplier-1') });
 *
 * // Business with custom fields
 * const supplier = createBusiness({
 *   id: makeUUID('business', 'supplier-usd'),
 *   name: 'American Supplier',
 *   country: 'USA',
 *   isReceiptEnough: true,
 * });
 * ```
 */
export function createBusiness(
  overrides?: Partial<FixtureBusinesses['businesses'][number]>,
): FixtureBusinesses['businesses'][number] {
  const defaultId = makeUUIDLegacy();
  return {
    id: defaultId,
    // Intelligent name defaulting: use provided id, or use generated UUID
    // This ensures display name is always meaningful even when only id is specified
    name: overrides?.id ?? defaultId,
    hebrewName: null,
    address: null,
    email: null,
    website: null,
    phoneNumber: null,
    governmentId: null,
    exemptDealer: false,
    suggestions: null,
    optionalVat: false, // Database requires NOT NULL
    country: CountryCode.Israel, // Database requires NOT NULL, default to Israel
    pcn874RecordTypeOverride: null,
    isReceiptEnough: false,
    isDocumentsOptional: false,
    ...overrides,
  };
}
