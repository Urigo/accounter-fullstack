import { ReactElement } from 'react';
import { DepreciationReportRecordCoreFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';
import { TableCell, TableRow } from '../../../ui/table.js';

type Props = {
  data: FragmentType<typeof DepreciationReportRecordCoreFragmentDoc>;
  groupName?: string;
};

export const DepreciationSummaryRow = ({ data, groupName }: Props): ReactElement => {
  const summary = getFragmentData(DepreciationReportRecordCoreFragmentDoc, data);

  return (
    <TableRow className="font-bold border-b border-black">
      <TableCell>{groupName ? 'Group Total' : 'Overall Total'}</TableCell>
      <TableCell colSpan={2}>{groupName}</TableCell>
      <TableCell>
        {summary.originalCost ? formatStringifyAmount(summary.originalCost, 0) : undefined}
      </TableCell>
      <TableCell>
        {summary.reportYearDelta ? formatStringifyAmount(summary.reportYearDelta, 0) : undefined}
      </TableCell>
      <TableCell>
        {summary.totalDepreciableCosts
          ? formatStringifyAmount(summary.totalDepreciableCosts, 0)
          : undefined}
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell>
        {summary.reportYearClaimedDepreciation
          ? formatStringifyAmount(summary.reportYearClaimedDepreciation, 0)
          : undefined}
      </TableCell>
      <TableCell>
        {summary.pastYearsAccumulatedDepreciation
          ? formatStringifyAmount(summary.pastYearsAccumulatedDepreciation, 0)
          : undefined}
      </TableCell>
      <TableCell>
        {summary.totalDepreciation
          ? formatStringifyAmount(summary.totalDepreciation, 0)
          : undefined}
      </TableCell>
      <TableCell>
        {summary.netValue ? formatStringifyAmount(summary.netValue, 0) : undefined}
      </TableCell>
    </TableRow>
  );
};
