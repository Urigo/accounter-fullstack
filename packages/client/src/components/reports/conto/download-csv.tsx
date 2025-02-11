import type { ReactElement } from 'react';
import { getDescendants, type NodeModel } from '@minoru/react-dnd-treeview';
import { DownloadCSVButton } from '../../common/index.js';
import { ContoReportFiltersType } from './conto-report-filters.js';
import { REPORT_TREE_ROOT_ID } from './index.js';
import type { CustomData } from './types.js';

interface Props {
  tree: NodeModel<CustomData>[];
  filters: ContoReportFiltersType;
}

export const DownloadCSV = ({ tree, filters }: Props): ReactElement => {
  if (!tree.length) {
    return <div />;
  }

  const datesString = getDatesString(filters.fromDate, filters.toDate);

  const csvData = convertToCSV(tree);
  const fileName = 'conto_report' + datesString;

  return <DownloadCSVButton data={csvData} fileName={fileName} />;
};

function getDatesString(fromDate?: string | null, toDate?: string | null): string {
  if (fromDate && toDate) {
    return `_${fromDate}_to_${toDate}`;
  }
  if (fromDate) {
    return `_since_${fromDate}`;
  }
  if (toDate) {
    return `_until_${toDate}`;
  }
  return '';
}

type Row = { content: string; depth: number; amount: number | string };

const convertToCSV = (tree: NodeModel<CustomData>[]): string => {
  const parentNodes = tree.filter(node => node.parent === REPORT_TREE_ROOT_ID);
  if (!parentNodes.length) {
    return 'No Report Data';
  }

  const rows: Row[] = [{ content: 'Account', depth: 0, amount: 'ILS Amount' }];

  const { rows: nodesRows, maxDepth } = recursiveRowHandler(parentNodes, tree, 0);
  rows.push(...nodesRows);

  return rows
    .map(
      row =>
        `${','.repeat(row.depth)}${sanitizeString(row.content)}${','.repeat(maxDepth - row.depth)},${sanitizeString(row.amount)}`,
    )
    .join('\r\n');
};

function recursiveRowHandler(
  nodes: NodeModel<CustomData>[],
  tree: NodeModel<CustomData>[],
  depth: number,
): { rows: Row[]; maxDepth: number } {
  if (nodes.length === 0) {
    return { rows: [], maxDepth: depth };
  }

  let maxDepth = depth;
  const rows: Row[] = [];
  nodes.map(node => {
    const mainRow = {
      content: node.text + node.data?.sortCode ? ` (${node.data?.sortCode})` : '',
      depth,
      amount: node.data?.value ?? '',
    };
    rows.push(mainRow);

    const children = getDescendants(tree, node.id);
    const childrenRows = recursiveRowHandler(children, tree, depth + 1);
    rows.push(...childrenRows.rows);
    if (childrenRows.maxDepth > maxDepth) {
      maxDepth = childrenRows.maxDepth;
    }
  });

  return {
    rows,
    maxDepth,
  };
}

function sanitizeString(content: string | number): string | number {
  if (!Number.isNaN(Number(content))) {
    return Number(content).toFixed(2);
  }
  const cleanContent = (content as string).replace(/"/g, '""').replace(/,/g, '.');
  return cleanContent;
}
