import type { AccountantStatus } from '../../../../gql/graphql.js';
import type { CustomData, FlatNode, NodeStats } from './types.js';

const CSV_HEADER = 'Name,Value (ILS),Depth,Status';

function escapeCsv(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * Builds the dynamic report CSV export: one row per report node in tree order, with its depth
 * under the report root. Branches carry their summed value and derived status, leaves their value
 * and effective status. The status cell is empty when a node has none. Hidden leaves are skipped.
 */
export function buildReportCsv(
  reportTree: FlatNode<CustomData>[],
  nodeStats: NodeStats,
  statusOf: (nodeId: string) => AccountantStatus | null | undefined,
  branchStatusOf: (branchId: string) => AccountantStatus | null | undefined,
): string {
  const rows: string[] = [CSV_HEADER];

  const childrenMap = new Map<string, FlatNode<CustomData>[]>();
  for (const node of reportTree) {
    const list = childrenMap.get(node.parent) ?? [];
    list.push(node);
    childrenMap.set(node.parent, list);
  }

  function traverse(parentId: string, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    for (const node of children) {
      if (node.data.isHidden) continue;
      if (node.droppable) {
        const sum = nodeStats.get(node.id)?.sum ?? 0;
        const status = branchStatusOf(node.id) ?? '';
        rows.push(`${escapeCsv(node.text)},${sum},${depth},${status}`);
        traverse(node.id, depth + 1);
      } else {
        const value = node.data.value ?? 0;
        const status = statusOf(node.id) ?? '';
        rows.push(`${escapeCsv(node.text)},${value},${depth},${status}`);
      }
    }
  }

  traverse('report', 0);

  return rows.join('\n');
}
