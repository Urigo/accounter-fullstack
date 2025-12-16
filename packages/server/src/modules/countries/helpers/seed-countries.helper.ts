/**
 * Shared utility for seeding countries table from CountryCode enum.
 * Used by both seed script and vitest global setup.
 */

import type { PoolClient } from 'pg';
import { CountryCode } from '../../../shared/enums.js';

const countryEntries = Object.entries(CountryCode);
const countryCodeToNameMap = new Map(countryEntries.map(([name, code]) => [code, name]));

/**
 * Get all countries from the CountryCode enum as an array of {name, code} objects.
 */
export function getAllCountries(): Array<{ name: string; code: string }> {
  return countryEntries.map(([name, code]) => ({
    name,
    code,
  }));
}

/**
 * Insert all countries from CountryCode enum into the countries table.
 * Uses ON CONFLICT DO NOTHING to make it idempotent.
 *
 * @param client - PostgreSQL client (from pool.connect() or standalone client)
 * @param schema - Schema name (default: 'accounter_schema')
 */
export async function seedCountries(
  client: PoolClient | { query: PoolClient['query'] },
  schema = 'accounter_schema',
): Promise<void> {
  const countries = getAllCountries();

  if (countries.length === 0) {
    return;
  }

  // Build VALUES clause dynamically
  const values = countries
    .map((_, index) => {
      const offset = index * 2;
      return `($${offset + 1}, $${offset + 2})`;
    })
    .join(',\n      ');

  const params = countries.flatMap(country => [country.name, country.code]);

  await client.query(
    `INSERT INTO ${schema}.countries (name, code)
     VALUES ${values}
     ON CONFLICT (code) DO NOTHING`,
    params,
  );
}

/**
 * Get a specific country by code from the CountryCode enum.
 */
export function getCountryByCode(code: string): { name: string; code: string } | null {
  const name = countryCodeToNameMap.get(code as CountryCode);
  if (!name) {
    return null;
  }
  return { name, code };
}
