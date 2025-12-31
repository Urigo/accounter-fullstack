/**
 * Placeholder strings used in demo fixtures for runtime replacement.
 */
export const PLACEHOLDERS = {
  ADMIN_BUSINESS_ID: '{{ADMIN_BUSINESS_ID}}',
} as const;

/**
 * Resolve admin business ID placeholders in fixture objects.
 *
 * This function performs a deep replacement of all `{{ADMIN_BUSINESS_ID}}` placeholder
 * strings within a fixture object by serializing to JSON, replacing all occurrences,
 * and deserializing back to the original type.
 *
 * @param fixture - Fixture object containing placeholders (any type)
 * @param adminBusinessId - The actual admin business UUID to replace placeholders with
 * @returns New fixture object with all placeholders replaced
 *
 * @example
 * ```typescript
 * const fixture = {
 *   id: 'charge-123',
 *   ownerId: '{{ADMIN_BUSINESS_ID}}',
 *   nested: {
 *     businessId: '{{ADMIN_BUSINESS_ID}}'
 *   }
 * };
 *
 * const resolved = resolveAdminPlaceholders(fixture, 'actual-uuid-123');
 * // {
 * //   id: 'charge-123',
 * //   ownerId: 'actual-uuid-123',
 * //   nested: { businessId: 'actual-uuid-123' }
 * // }
 * ```
 *
 * @remarks
 * **Performance Note:**
 * Uses JSON serialization for deep replacement. For very large fixture objects,
 * consider a more optimized approach if performance becomes an issue.
 *
 * **Type Safety:**
 * Returns the same type as input, but type information is lost during JSON
 * serialization (e.g., Date objects become strings). Use with plain object fixtures.
 */
export function resolveAdminPlaceholders<T>(fixture: T, adminBusinessId: string): T {
  const json = JSON.stringify(fixture);
  const resolved = json.replace(/\{\{ADMIN_BUSINESS_ID\}\}/g, adminBusinessId);
  return JSON.parse(resolved) as T;
}
