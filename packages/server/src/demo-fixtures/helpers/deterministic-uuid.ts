import { randomUUID } from 'node:crypto';
import { v5 as uuidv5 } from 'uuid';

/**
 * Fixed namespace for all demo data (regenerate on schema-breaking changes if needed).
 * Using standard DNS namespace UUID as recommended by RFC 4122.
 */
const DEMO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate deterministic UUID v5 from semantic name.
 *
 * This function creates stable, reproducible UUIDs for demo/staging data entities.
 * The same namespace + name combination will always produce the same UUID across
 * deployments, making it safe to reference these IDs in documentation, screenshots,
 * and external links.
 *
 * @param namespace - Entity type: 'business', 'charge', 'transaction', 'document', etc.
 * @param name - Semantic identifier (kebab-case recommended)
 * @returns UUID v5 string (e.g., '550e8400-e29b-41d4-a716-446655440000')
 *
 * @example
 * ```typescript
 * // Business entity
 * makeUUID('business', 'acme-consulting-llc')
 * // => Always produces same UUID
 *
 * // Charge entity
 * makeUUID('charge', 'consulting-invoice-2024-11')
 * // => Stable across deploys
 *
 * // Financial account
 * makeUUID('financial-account', 'bank-usd-account')
 * // => Different from makeUUID('business', 'bank-usd-account')
 * ```
 *
 * @remarks
 * **Naming Conventions:**
 * - Use kebab-case for all semantic names
 * - Combine entity type + descriptive name ensures no collisions
 * - Never change a semantic name once deployed (breaks external links)
 * - For updates to same entity, append version: `acme-consulting-llc-v2`
 *
 * **Stability Warning:**
 * Once a UUID is generated and used in staging/production, the semantic name
 * MUST NOT be changed. Doing so will generate a different UUID and break:
 * - External documentation with embedded links
 * - Screenshots with visible UUIDs
 * - Any hardcoded references in client applications
 *
 * If you need to modify an entity, create a new semantic name with a version suffix.
 */
export function makeUUID(namespace: string, name: string): string {
  const composite = `${namespace}:${name}`;
  return uuidv5(composite, DEMO_NAMESPACE);
}

/**
 * Backward compatible adapter for legacy single-argument API.
 * - When seed is provided, returns deterministic UUID v5 scoped under 'legacy' namespace
 * - When seed omitted, returns a random UUID to preserve previous behavior
 */
export function makeUUIDLegacy(seed?: string): string {
  if (seed === undefined || seed === null) {
    return randomUUID();
  }
  return makeUUID('legacy', seed);
}
