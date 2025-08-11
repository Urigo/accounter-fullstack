import { useCallback, type ReactElement } from 'react';
import { getDescendants, type NodeModel } from '@minoru/react-dnd-treeview';
import { DownloadCSVButton } from '../../common/index.js';
import type { ContoReportFiltersType } from './conto-report-filters.js';
import { REPORT_TREE_ROOT_ID } from './index.js';
import type { CustomData } from './types.js';

interface Props {
  tree: NodeModel<CustomData>[];
  filters: ContoReportFiltersType;
}

export const DownloadCSV = ({ tree, filters }: Props): ReactElement => {
  const createFileVariables = useCallback(async () => {
    const datesString = getDatesString(filters.fromDate, filters.toDate);

    const csvData = convertToCSV(tree);
    const fileName = 'conto_report' + datesString;

    return { fileContent: csvData, fileName };
  }, [filters.fromDate, filters.toDate, tree]);

  if (!tree.length) {
    return <div />;
  }

  return <DownloadCSVButton createFileVariables={createFileVariables} />;
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

type Row = {
  content: string;
  depth: number;
  amount: number | string;
  suffix: string | number;
  type: 'CATEGORY' | 'SORT_CODE' | 'FINANCIAL_ENTITY';
};

const convertToCSV = (tree: NodeModel<CustomData>[]): string => {
  const parentNodes = tree.filter(node => node.parent === REPORT_TREE_ROOT_ID);
  if (!parentNodes.length) {
    return 'No Report Data';
  }

  const rows: Row[] = [
    { content: 'Account', depth: 0, amount: 'ILS Amount', suffix: '', type: 'CATEGORY' },
  ];

  const { rows: nodesRows, maxDepth } = recursiveRowHandler(parentNodes, tree, 0);
  rows.push(...nodesRows);

  return rows
    .map(row => {
      const { depth } = row;
      let pre = depth;
      let post = maxDepth - depth;
      switch (row.type) {
        case 'SORT_CODE':
          pre = maxDepth - 1;
          post = 1;
          break;
        case 'FINANCIAL_ENTITY':
          pre = maxDepth;
          post = 0;
          break;
      }
      return `${','.repeat(pre)}${sanitizeString(row.content)},${sanitizeString(row.suffix ?? '')}${','.repeat(post)},${sanitizeString(row.amount)}`;
    })
    .join('\r\n');
};

function recursiveRowHandler(
  nodes: NodeModel<CustomData>[],
  tree: NodeModel<CustomData>[],
  depth: number,
): { rows: Row[]; maxDepth: number; sum: number } {
  if (nodes.length === 0) {
    return { rows: [], maxDepth: depth, sum: 0 };
  }

  let maxDepth = depth;
  const rows: Row[] = [];
  let sum = 0;
  nodes.map(node => {
    if (node.data?.value != null) {
      sum += node.data.value;
      const onlyRow: Row = {
        content: node.text,
        depth,
        amount: node.data.value,
        suffix: '',
        type: 'FINANCIAL_ENTITY',
      };
      rows.push(onlyRow);
      return;
    }

    const children = getDescendants(tree, node.id);
    const directChildren = children.filter(child => child.parent === node.id);

    const mainRow: Row = {
      content: node.text,
      suffix: node.data?.sortCode ?? '',
      depth,
      amount: children.reduce((acc, child) => acc + (child.data?.value ?? 0), 0),
      type: node.data?.sortCode ? 'SORT_CODE' : 'CATEGORY',
    };
    rows.push(mainRow);

    const childrenRows = recursiveRowHandler(directChildren, tree, depth + 1);
    rows.push(...childrenRows.rows);
    if (childrenRows.maxDepth > maxDepth) {
      maxDepth = childrenRows.maxDepth;
    }
  });

  return {
    rows,
    maxDepth,
    sum,
  };
}

function sanitizeString(content: string | number): string | number {
  if (content === '') {
    return '';
  }
  if (!Number.isNaN(Number(content))) {
    return Number(content).toFixed(2);
  }
  const cleanContent = (content as string).replace(/"/g, '""').replace(/,/g, '.');
  return cleanContent;
}
