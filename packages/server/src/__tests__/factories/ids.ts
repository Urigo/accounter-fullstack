import { randomUUID } from 'node:crypto';

/**
 * Generate a UUID for use in test fixtures
 *
 * @param seed - Optional seed string for deterministic UUID generation
 * @returns A valid UUID v4 string
 *
 * @remarks
 * - When seed is provided, generates a deterministic UUID based on the seed
 * - When seed is omitted, generates a random UUID
 * - Deterministic mode uses a simple hash-based approach for test reproducibility
 *
 * @example
 * ```typescript
 * // Random UUID
 * const id1 = makeUUID(); // e.g., '123e4567-e89b-12d3-a456-426614174000'
 *
 * // Deterministic UUID (same seed always produces same UUID)
 * const id2 = makeUUID('admin-business'); // Always same UUID
 * const id3 = makeUUID('admin-business'); // Same as id2
 * ```
 */
export function makeUUID(seed?: string): string {
  // Check for undefined or null (not provided), but treat empty string as valid seed
  if (seed === undefined || seed === null) {
    return randomUUID();
  }

  // Simple deterministic UUID generation from seed
  // Use a basic hash to convert seed to hex values
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate deterministic hex values
  const hex = (Math.abs(hash) * 123456789).toString(16).padStart(32, '0').slice(0, 32);

  // Format as UUID v4 (with version and variant bits set correctly)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`, // Version 4
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}`, // Variant bits
    hex.slice(20, 32),
  ].join('-');
}
