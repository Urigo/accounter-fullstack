import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  DepreciationReportDisposalsFragmentDoc,
  type DepreciationDisposalType,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { formatTimelessDate } from '../../../../helpers/dates.js';
import { formatStringifyAmount } from '../../../../helpers/numbers.js';
import { ROUTES } from '../../../../router/routes.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepreciationReportDisposals on DepreciationReportRecord {
    id
    chargeId
    description
    disposals {
      id
      type
      disposalDate
      description
      charge {
        id
      }
      disposedCost {
        raw
      }
      accumulatedDepreciation {
        raw
      }
      netBookValue {
        raw
      }
      proceeds {
        raw
      }
      gainLoss {
        raw
      }
    }
  }
`;

export const DISPOSAL_TYPE_LABELS: Record<DepreciationDisposalType, string> = {
  SALE: 'Sale',
  COST_REFUND: 'Cost refund',
  WRITE_OFF: 'Write-off',
};

const amount = (value: number) =>
  value < 0 ? `(${formatStringifyAmount(-value, 0)})` : formatStringifyAmount(value, 0);

type Props = {
  records: FragmentType<typeof DepreciationReportDisposalsFragmentDoc>[];
};

/** The report year's disposals: the working paper behind the disposals columns (1342 / 1399ח) */
export const DepreciationDisposalsTable = ({ records }: Props): ReactElement | null => {
  const rows = records
    .map(record => getFragmentData(DepreciationReportDisposalsFragmentDoc, record))
    .flatMap(record => record.disposals.map(disposal => ({ record, disposal })))
    .sort((a, b) => a.disposal.disposalDate.localeCompare(b.disposal.disposalDate));

  if (rows.length === 0) {
    return null;
  }

  const total = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((sum, row) => sum + pick(row), 0);

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-2">Disposals During the Year</h3>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-black">
            <TableHead>Asset</TableHead>
            <TableHead>Disposal Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Disposed Cost</TableHead>
            <TableHead>Accumulated Depreciation</TableHead>
            <TableHead>Net Book Value</TableHead>
            <TableHead>Proceeds</TableHead>
            <TableHead>Gain / (Loss)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ record, disposal }) => (
            <TableRow key={disposal.id}>
              <TableCell>
                <Link className="underline" to={ROUTES.CHARGES.DETAIL(record.chargeId)}>
                  {record.description ?? 'Asset'}
                </Link>
                {disposal.description && (
                  <span className="block text-xs text-muted-foreground">
                    {disposal.description}
                  </span>
                )}
              </TableCell>
              <TableCell>{formatTimelessDate(disposal.disposalDate, 'dd/MM/yyyy')}</TableCell>
              <TableCell>
                {disposal.charge ? (
                  <Link className="underline" to={ROUTES.CHARGES.DETAIL(disposal.charge.id)}>
                    {DISPOSAL_TYPE_LABELS[disposal.type]}
                  </Link>
                ) : (
                  DISPOSAL_TYPE_LABELS[disposal.type]
                )}
              </TableCell>
              <TableCell>{amount(disposal.disposedCost.raw)}</TableCell>
              <TableCell>{amount(disposal.accumulatedDepreciation.raw)}</TableCell>
              <TableCell>{amount(disposal.netBookValue.raw)}</TableCell>
              <TableCell>{amount(disposal.proceeds.raw)}</TableCell>
              <TableCell>{amount(disposal.gainLoss.raw)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold border-b border-black">
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell>{amount(total(row => row.disposal.disposedCost.raw))}</TableCell>
            <TableCell>{amount(total(row => row.disposal.accumulatedDepreciation.raw))}</TableCell>
            <TableCell>{amount(total(row => row.disposal.netBookValue.raw))}</TableCell>
            <TableCell>{amount(total(row => row.disposal.proceeds.raw))}</TableCell>
            <TableCell>{amount(total(row => row.disposal.gainLoss.raw))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
