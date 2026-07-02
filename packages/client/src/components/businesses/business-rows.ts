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
  // categorization
  sortCodeKey: number | null;
  taxCategoryName: string | null;
  irsCode: number | null;
  pcn874RecordType: string | null;
  // extension tags
  isClient: boolean;
  isAdmin: boolean;
  isActive: boolean;
  // suggestion defaults
  suggestionDescription: string | null;
  suggestionTags: string[];
};

/** Usage counts merged into table rows once the lazy usage query resolves (null until loaded). */
export type BusinessUsageCounts = {
  totalTransactions: number | null;
  totalDocuments: number | null;
  totalMiscExpenses: number | null;
  totalLedgerRecords: number | null;
};

/** A business table row: the mapped business plus its (optionally loaded) usage counts. */
export type BusinessTableRow = BusinessRow & BusinessUsageCounts;

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
  // DateTime scalars arrive as ISO strings at runtime (no urql scalar exchange), even though
  // codegen types them as Date; accept both and parse below.
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  sortCode?: { key?: number | null; name?: string | null } | null;
  taxCategory?: { name?: string | null } | null;
  irsCode?: number | null;
  pcn874RecordType?: string | null;
  isClient?: boolean | null;
  isAdmin?: boolean | null;
  isActive?: boolean | null;
  suggestions?: {
    description?: string | null;
    tags?: ReadonlyArray<{ name?: string | null }> | null;
  } | null;
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
      createdAt: node.createdAt ? new Date(node.createdAt) : null,
      updatedAt: node.updatedAt ? new Date(node.updatedAt) : null,
      sortCodeKey: node.sortCode?.key ?? null,
      taxCategoryName: node.taxCategory?.name ?? null,
      irsCode: node.irsCode ?? null,
      pcn874RecordType: node.pcn874RecordType ?? null,
      isClient: node.isClient ?? false,
      isAdmin: node.isAdmin ?? false,
      isActive: node.isActive ?? true,
      suggestionDescription: node.suggestions?.description ?? null,
      suggestionTags:
        node.suggestions?.tags?.map(tag => tag.name).filter((name): name is string => !!name) ?? [],
    }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Human-readable locality from city / zip / country code, skipping the empty parts. */
export function formatLocality(row: Pick<BusinessRow, 'city' | 'zipCode' | 'countryCode'>): string {
  return [row.city, row.zipCode, row.countryCode].filter(Boolean).join(', ');
}

/** Merge per-business usage counts (from the lazy usage query) into the table rows by id. */
export function mergeBusinessUsage(
  rows: readonly BusinessRow[],
  usage: readonly ({ businessId: string } & BusinessUsageCounts)[],
): BusinessTableRow[] {
  const byId = new Map<string, BusinessUsageCounts>();
  for (const entry of usage) {
    byId.set(entry.businessId, entry);
  }
  return rows.map(row => {
    const counts = byId.get(row.id);
    return {
      ...row,
      totalTransactions: counts?.totalTransactions ?? null,
      totalDocuments: counts?.totalDocuments ?? null,
      totalMiscExpenses: counts?.totalMiscExpenses ?? null,
      totalLedgerRecords: counts?.totalLedgerRecords ?? null,
    };
  });
}

/** Client-side filters applied over all business rows. */
export type BusinessRowFilters = {
  name: string;
  client: boolean;
  admin: boolean;
  inactive: boolean;
  unusedOnly: boolean;
  sortCode: string;
  taxCategory: string;
};

/** A row is "unused" only once all four usage counts are known and zero. */
function isUnused(row: BusinessTableRow): boolean {
  return (
    row.totalTransactions === 0 &&
    row.totalDocuments === 0 &&
    row.totalMiscExpenses === 0 &&
    row.totalLedgerRecords === 0
  );
}

/** Filter rows by the extension-tag flags, usage and free-text sort-code / tax-category. */
export function filterBusinessRows(
  rows: readonly BusinessTableRow[],
  filters: BusinessRowFilters,
): BusinessTableRow[] {
  const name = filters.name.trim().toLowerCase();
  const sortCode = filters.sortCode.trim();
  const taxCategory = filters.taxCategory.trim().toLowerCase();
  return rows.filter(row => {
    if (name && !`${row.name} ${row.hebrewName ?? ''}`.toLowerCase().includes(name)) {
      return false;
    }
    if (filters.client && !row.isClient) {
      return false;
    }
    if (filters.admin && !row.isAdmin) {
      return false;
    }
    if (filters.inactive && row.isActive) {
      return false;
    }
    if (filters.unusedOnly && !isUnused(row)) {
      return false;
    }
    if (sortCode && !String(row.sortCodeKey ?? '').includes(sortCode)) {
      return false;
    }
    if (taxCategory && !(row.taxCategoryName ?? '').toLowerCase().includes(taxCategory)) {
      return false;
    }
    return true;
  });
}
