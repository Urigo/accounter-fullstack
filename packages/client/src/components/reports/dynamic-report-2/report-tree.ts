import type { DynamicReportQuery } from '../../../gql/graphql.js';
import type { CustomData, FlatNode } from './types.js';

export const REPORT_ROOT = 'report';

const BRANCH_NODE_TYPES = ['sort-code-branch', 'synthetic-branch'] as const;
type BranchNodeType = (typeof BRANCH_NODE_TYPES)[number];

function asBranchNodeType(t: string): BranchNodeType {
  return (BRANCH_NODE_TYPES as readonly string[]).includes(t)
    ? (t as BranchNodeType)
    : 'synthetic-branch';
}

type TemplateNode = {
  id: string | number;
  parent: string | number;
  text: string;
  droppable: boolean;
  data: {
    nodeType: string;
    isOpen: boolean;
    hebrewText?: string;
    sortCode?: number | null;
  };
};

type BusinessSum = Extract<
  NonNullable<DynamicReportQuery['businessTransactionsSumFromLedgerRecords']>,
  { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
>['businessTransactionsSum'][number];

export function buildReportTree(
  templateNodes: TemplateNode[],
  businessSums: BusinessSum[],
): { reportTree: FlatNode<CustomData>[]; placedEntityIds: Set<string> } {
  const sumById = new Map<string, BusinessSum>();
  for (const b of businessSums) {
    sumById.set(b.business.id, b);
  }

  const reportTree: FlatNode<CustomData>[] = [];
  const placedEntityIds = new Set<string>();

  for (const node of templateNodes) {
    const parent = node.parent === 0 || node.parent === '0' ? REPORT_ROOT : String(node.parent);
    const id = String(node.id);

    if (node.droppable) {
      // Branch node — validate nodeType is a branch type (never 'financial-entity')
      const data: CustomData = {
        nodeType: asBranchNodeType(node.data.nodeType),
        isOpen: node.data.isOpen,
        ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
        ...(node.data.sortCode == null ? {} : { sortCode: node.data.sortCode }),
      };

      if (node.data.nodeType === 'sort-code-branch' && typeof node.id === 'number') {
        data.sortCode = node.id;
      }

      reportTree.push({ id, parent, text: node.text, droppable: true, data });
    } else {
      // Entity leaf — hydrate from businessSums; drop if not found
      const bizSum = sumById.get(id);
      if (!bizSum) continue;

      placedEntityIds.add(id);
      reportTree.push({
        id,
        parent,
        text: bizSum.business.name,
        droppable: false,
        data: {
          nodeType: 'financial-entity',
          isOpen: node.data.isOpen,
          value: bizSum.total.raw * -1,
          ...(node.data.hebrewText == null ? {} : { hebrewText: node.data.hebrewText }),
        },
      });
    }
  }

  return { reportTree, placedEntityIds };
}
