import type { DynamicReportQuery } from '../../../gql/graphql.js';
import { REPORT_ROOT } from './report-tree.js';
import type { CustomData, FlatNode } from './types.js';

export type LegacyTemplateNode = {
  id: string | number;
  parent: string | number;
  text: string;
  droppable: boolean;
  data: {
    isOpen: boolean;
    hebrewText?: string;
    sortCode?: number | null;
    descendantFinancialEntities?: string[] | null;
    descendantSortCodes?: number[] | null;
    mergedSortCodes?: number[] | null;
  };
};

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

export function isLegacyTemplateNodes(nodes: LegacyTemplateNode[]): boolean {
  return nodes.some(n => 'descendantSortCodes' in n.data);
}

export function migrateLegacyTemplateNodes(
  nodes: LegacyTemplateNode[],
  businessSums: BusinessSum[],
): FlatNode<CustomData>[] {
  const sumById = new Map<string, BusinessSum>();
  for (const b of businessSums) {
    sumById.set(b.business.id, b);
  }

  // Collect ids of explicit leaf nodes already present in the template
  const explicitLeafIds = new Set<string>();
  for (const n of nodes) {
    if (!n.droppable) {
      explicitLeafIds.add(String(n.id));
    }
  }

  const result: FlatNode<CustomData>[] = [];
  const processedIds = new Set<string>();

  for (const node of nodes) {
    const id = String(node.id);
    if (processedIds.has(id)) continue;

    const parent = node.parent === 0 || node.parent === '0' ? REPORT_ROOT : String(node.parent);

    if (node.droppable) {
      const nodeType: CustomData['nodeType'] =
        node.data.sortCode == null ? 'synthetic-branch' : 'sort-code-branch';

      result.push({
        id,
        parent,
        text: node.text,
        droppable: true,
        data: {
          nodeType,
          isOpen: node.data.isOpen,
          ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
          ...(node.data.sortCode == null ? {} : { sortCode: node.data.sortCode }),
        },
      });
      processedIds.add(id);

      // Expand descendantFinancialEntities into explicit leaf nodes
      for (const uuid of node.data.descendantFinancialEntities ?? []) {
        if (explicitLeafIds.has(uuid) || processedIds.has(uuid)) continue;
        const bizSum = sumById.get(uuid);
        if (!bizSum) continue;
        processedIds.add(uuid);
        result.push({
          id: uuid,
          parent: id,
          text: bizSum.business.name,
          droppable: false,
          data: {
            nodeType: 'financial-entity',
            value: bizSum.total.raw * -1,
            isOpen: false,
          },
        });
      }
    } else {
      // Explicit leaf already in template — keep as-is (hydrated from businessSums if available)
      const bizSum = sumById.get(id);
      if (!bizSum) continue;
      result.push({
        id,
        parent,
        text: bizSum.business.name,
        droppable: false,
        data: {
          nodeType: 'financial-entity',
          value: bizSum.total.raw * -1,
          isOpen: node.data.isOpen,
          ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
        },
      });
      processedIds.add(id);
    }
  }

  return result;
}
