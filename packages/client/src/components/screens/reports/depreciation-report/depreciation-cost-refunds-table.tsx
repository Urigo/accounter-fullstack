import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  DepreciationReportCostRefundsFragmentDoc,
  type DepreciationRefundMode,
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
  fragment DepreciationReportCostRefunds on DepreciationReportRecord {
    id
    chargeId
    description
    costRefunds {
      id
      refundMode
      disposalDate
      description
      charge {
        id
      }
      costReduction {
        raw
      }
      depreciationCorrection {
        raw
      }
    }
  }
`;

const REFUND_MODE_LABELS: Record<DepreciationRefundMode, string> = {
  FROM_ACTIVATION: 'From activation',
  FROM_REFUND_DATE: 'From refund date',
};

type Props = {
  records: FragmentType<typeof DepreciationReportCostRefundsFragmentDoc>[];
};

/**
 * The report year's cost refunds: corrections to cost, not disposals. The correction is the
 * depreciation they reverse, booked as ordinary income.
 */
export const DepreciationCostRefundsTable = ({ records }: Props): ReactElement | null => {
  const rows = records
    .map(record => getFragmentData(DepreciationReportCostRefundsFragmentDoc, record))
    .flatMap(record => record.costRefunds.map(refund => ({ record, refund })))
    .sort((a, b) => a.refund.disposalDate.localeCompare(b.refund.disposalDate));

  if (rows.length === 0) {
    return null;
  }

  const total = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((sum, row) => sum + pick(row), 0);

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-2">Cost Refunds During the Year</h3>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-black">
            <TableHead>Asset</TableHead>
            <TableHead>Refund Date</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Cost Reduction</TableHead>
            <TableHead>Depreciation Correction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ record, refund }) => {
            const mode = REFUND_MODE_LABELS[refund.refundMode ?? 'FROM_ACTIVATION'];
            return (
              <TableRow key={refund.id}>
                <TableCell>
                  <Link className="underline" to={ROUTES.CHARGES.DETAIL(record.chargeId)}>
                    {record.description ?? 'Asset'}
                  </Link>
                  {refund.description && (
                    <span className="block text-xs text-muted-foreground">
                      {refund.description}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatTimelessDate(refund.disposalDate, 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  {refund.charge ? (
                    <Link className="underline" to={ROUTES.CHARGES.DETAIL(refund.charge.id)}>
                      {mode}
                    </Link>
                  ) : (
                    mode
                  )}
                </TableCell>
                <TableCell>{formatStringifyAmount(refund.costReduction.raw, 0)}</TableCell>
                <TableCell>{formatStringifyAmount(refund.depreciationCorrection.raw, 0)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="font-bold border-b border-black">
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell>
              {formatStringifyAmount(
                total(row => row.refund.costReduction.raw),
                0,
              )}
            </TableCell>
            <TableCell>
              {formatStringifyAmount(
                total(row => row.refund.depreciationCorrection.raw),
                0,
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
