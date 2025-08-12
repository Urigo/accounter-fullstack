import type { ReactElement } from 'react';
import { format } from 'date-fns';
import {
  DepreciationReportRecordCoreFragmentDoc,
  type DepreciationReportScreenQuery,
} from '../../../../gql/graphql.js';
import { getFragmentData } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/numbers.js';
import { TableCell, TableRow } from '../../../ui/table.js';

type Props = {
  record: DepreciationReportScreenQuery['depreciationReport']['categories'][number]['records'][number];
};

export const DepreciationRecordRow = ({ record }: Props): ReactElement => {
  const summary = getFragmentData(DepreciationReportRecordCoreFragmentDoc, record);

  return (
    <TableRow>
      <TableCell>{record.description}</TableCell>
      <TableCell>{format(new Date(record.purchaseDate), 'dd/MM/yyyy')}</TableCell>
      <TableCell>
        {record.activationDate ? format(new Date(record.activationDate), 'dd/MM/yyyy') : undefined}
      </TableCell>
      <TableCell>
        {summary.originalCost ? formatStringifyAmount(summary.originalCost, 0) : undefined}
      </TableCell>
      <TableCell>
        {summary.reportYearDelta ? formatStringifyAmount(summary.reportYearDelta, 0) : undefined}
      </TableCell>
      <TableCell>{formatStringifyAmount(summary.totalDepreciableCosts, 0)}</TableCell>
      <TableCell>{formatStringifyAmount(record.statutoryDepreciationRate, 0)}%</TableCell>
      <TableCell>
        {record.claimedDepreciationRate
          ? `${formatStringifyAmount(record.claimedDepreciationRate, 1)}%`
          : '-'}
      </TableCell>
      <TableCell>
        {summary.reportYearClaimedDepreciation
          ? formatStringifyAmount(summary.reportYearClaimedDepreciation, 0)
          : '-'}
      </TableCell>
      <TableCell>
        {summary.pastYearsAccumulatedDepreciation
          ? formatStringifyAmount(summary.pastYearsAccumulatedDepreciation, 0)
          : '-'}
      </TableCell>
      <TableCell>
        {summary.totalDepreciation ? formatStringifyAmount(summary.totalDepreciation, 0) : '-'}
      </TableCell>
      <TableCell>{summary.netValue ? formatStringifyAmount(summary.netValue, 0) : '-'}</TableCell>
    </TableRow>
  );
};
