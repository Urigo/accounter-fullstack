import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReportCommentaryTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import type { FragmentType } from '../../../gql/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ReportCommentaryRow } from './report-commentary-row.js';

/** `getFragmentData` is identity at runtime, so plain objects stand in for the fragments. */
const COMMENTARY = {
  records: [
    {
      sortCode: { id: 'sc-800', key: 800, name: 'Software subscriptions' },
      amount: { formatted: '₪42,500.00' },
      records: [
        {
          financialEntity: { id: 'fe-1', name: 'Vercel' },
          amount: { formatted: '₪18,200.00' },
          ledgerRecords: [],
        },
        {
          financialEntity: { id: 'fe-2', name: 'Amazon Web Services' },
          amount: { formatted: '₪24,300.00' },
          ledgerRecords: [],
        },
      ],
    },
    {
      sortCode: { id: 'sc-910', key: 910, name: 'Travel' },
      amount: { formatted: '₪9,140.00' },
      records: [
        {
          financialEntity: { id: 'fe-3', name: 'United Airlines' },
          amount: { formatted: '₪9,140.00' },
          ledgerRecords: [],
        },
      ],
    },
  ],
} as unknown as FragmentType<typeof ReportCommentaryTableFieldsFragmentDoc>;

/**
 * The commentary drill-down shared by the profit-and-loss and tax reports, moved off
 * Mantine's `Table`. It is the only nested table in `reports/` and the only `striped` one, so
 * it is where the zebra rows and the inner table's own header are worth looking at.
 *
 * Expand the outer row, then a sort-code row, to reach the sub-commentary table.
 */
function Harness(): ReactElement {
  return (
    <div className="p-4">
      <Table className="text-base">
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ReportCommentaryRow
            commentaryData={COMMENTARY}
            dataRow={button => (
              <TableRow>
                <TableCell>Research & Development</TableCell>
                <TableCell>₪51,640.00</TableCell>
                <TableCell>{button}</TableCell>
              </TableRow>
            )}
          />
        </TableBody>
      </Table>
    </div>
  );
}

const meta = {
  title: 'Reports/ReportCommentaryRow',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
