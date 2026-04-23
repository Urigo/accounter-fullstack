import type { AllSortCodesQuery, DynamicReportQuery } from '../../../gql/graphql.js';
import type { CustomData, FlatNode } from './types.js';

export const BANK_ROOT = 'bank';

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

/**
 * Builds the initial bank flat-tree from live GraphQL data.
 *
 * - Sort-code branches are ordered ascending by sortCode.key.
 * - Only emits a sort-code branch when at least one visible entity belongs to it.
 * - Entities with no sort code appear after all branches, sorted alphabetically.
 * - Excluded entity ids (already placed in the report tree) are omitted.
 * - If includeZeroed is false, entities with total.raw === 0 are omitted.
 */
export function buildInitialBankTree(
  sortCodes: AllSortCodesQuery['allSortCodes'],
  businessSums: BusinessSum[],
  excludedIds: Set<string>,
  includeZeroed: boolean,
): FlatNode<CustomData>[] {
  // 1. Filter
  const filtered = businessSums.filter(b => {
    if (excludedIds.has(b.business.id)) return false;
    if (!includeZeroed && b.total.raw === 0) return false;
    return true;
  });

  // 2. Group by sort code id
  const bySortCodeId = new Map<
    string,
    { key: number; name: string | null | undefined; entities: BusinessSum[] }
  >();
  const noSortCode: BusinessSum[] = [];

  // Pre-index sort codes for O(1) lookup
  const sortCodeMap = new Map(sortCodes.map(sc => [sc.id, sc]));
  for (const b of filtered) {
    const sc = b.business.sortCode;
    if (sc) {
      if (!bySortCodeId.has(sc.id)) {
        // Prefer the richer name from the sortCodes param if available
        const scParam = sortCodeMap.get(sc.id);
        bySortCodeId.set(sc.id, {
          key: sc.key,
          name: scParam?.name ?? sc.name,
          entities: [],
        });
      }
      bySortCodeId.get(sc.id)!.entities.push(b);
    } else {
      noSortCode.push(b);
    }
  }

  // 3. Sort branches ascending by key
  const sortedBranches = [...bySortCodeId.entries()].sort((a, b) => a[1].key - b[1].key);

  const result: FlatNode<CustomData>[] = [];

  for (const [scId, { key, name, entities }] of sortedBranches) {
    result.push({
      id: scId,
      parent: BANK_ROOT,
      text: `${key} — ${name ?? ''}`,
      droppable: true,
      data: { nodeType: 'sort-code-branch', sortCode: key, isOpen: false },
    });

    for (const b of entities) {
      result.push({
        id: b.business.id,
        parent: scId,
        text: b.business.name,
        droppable: false,
        data: { nodeType: 'financial-entity', value: b.total.raw * -1, isOpen: false },
      });
    }
  }

  // 4. No-sort-code entities — alphabetical
  noSortCode.sort((a, b) => a.business.name.localeCompare(b.business.name));
  for (const b of noSortCode) {
    result.push({
      id: b.business.id,
      parent: BANK_ROOT,
      text: b.business.name,
      droppable: false,
      data: { nodeType: 'financial-entity', value: b.total.raw * -1, isOpen: false },
    });
  }

  return result;
}
