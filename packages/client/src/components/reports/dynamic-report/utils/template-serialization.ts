import { REPORT_ROOT } from './report-tree.js';
import type { CustomData, FlatNode } from './types.js';

type SerializedNodeData = {
  nodeType: string;
  isOpen: boolean;
  hebrewText?: string;
  sortCode?: number;
};

type SerializedNode = {
  id: string;
  parent: string;
  text: string;
  droppable: boolean;
  data: SerializedNodeData;
};

/**
 * Collects the ids of all nodes reachable from REPORT_ROOT (i.e. the report subtree).
 */
function collectReportIds(nodes: FlatNode<CustomData>[]): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    const arr = childrenMap.get(node.parent) ?? [];
    arr.push(node.id);
    childrenMap.set(node.parent, arr);
  }

  const ids = new Set<string>();
  const queue = childrenMap.get(REPORT_ROOT) ?? [];
  const toVisit = [...queue];
  while (toVisit.length > 0) {
    const id = toVisit.pop()!;
    ids.add(id);
    for (const childId of childrenMap.get(id) ?? []) {
      toVisit.push(childId);
    }
  }
  return ids;
}

/**
 * Converts the in-memory reportTree to the JSON string stored in the DB.
 * Only report nodes (whose parent chain leads to REPORT_ROOT) are included.
 * Runtime fields (value, entityType) are stripped — only persisted fields are kept.
 */
export function serializeReportTree(reportTree: FlatNode<CustomData>[]): string {
  const reportIds = collectReportIds(reportTree);

  const serialized: SerializedNode[] = [];
  for (const node of reportTree) {
    if (!reportIds.has(node.id)) continue;

    const data: SerializedNodeData = {
      nodeType: node.data.nodeType,
      isOpen: node.data.isOpen,
    };
    if (node.data.hebrewText) {
      data.hebrewText = node.data.hebrewText;
    }
    if (node.data.sortCode != null) {
      data.sortCode = node.data.sortCode;
    }

    serialized.push({
      id: node.id,
      parent: node.parent,
      text: node.text,
      droppable: node.droppable,
      data,
    });
  }

  return JSON.stringify(serialized);
}
