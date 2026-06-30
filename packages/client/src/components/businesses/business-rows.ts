/**
 * Pure helpers that turn the `allBusinesses` query nodes into flat rows for the
 * business management table. Kept free of React/urql imports so they are easy to unit test.
 */

export type BusinessRow = {
  id: string;
  name: string;
  hebrewName: string | null;
  governmentId: string | null;
  countryCode: string | null;
  city: string | null;
  zipCode: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/** Minimal shape of an `allBusinesses` node consumed by the table (LtdFinancialEntity fields). */
type RawBusinessNode = {
  __typename?: string | null;
  id: string;
  name: string;
  hebrewName?: string | null;
  governmentId?: string | null;
  country?: { code?: string | null } | null;
  city?: string | null;
  zipCode?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** Keep only company businesses, map them to table rows and sort by name (case-insensitive). */
export function businessNodesToRows(nodes: readonly RawBusinessNode[]): BusinessRow[] {
  return nodes
    .filter(node => node.__typename === 'LtdFinancialEntity')
    .map(node => ({
      id: node.id,
      name: node.name,
      hebrewName: node.hebrewName ?? null,
      governmentId: node.governmentId ?? null,
      countryCode: node.country?.code ?? null,
      city: node.city ?? null,
      zipCode: node.zipCode ?? null,
      createdAt: node.createdAt ?? null,
      updatedAt: node.updatedAt ?? null,
    }))
    .sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
}

/** Human-readable locality from city / zip / country code, skipping the empty parts. */
export function formatLocality(row: Pick<BusinessRow, 'city' | 'zipCode' | 'countryCode'>): string {
  return [row.city, row.zipCode, row.countryCode].filter(Boolean).join(', ');
}
