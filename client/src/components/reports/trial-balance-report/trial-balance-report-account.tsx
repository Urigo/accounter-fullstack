import { useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { TrialBalanceReportQuery } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { BusinessExtendedInfo } from '../../business-transactions/business-extended-info';
import { TrialBalanceReportFilters } from './trial-balance-report-filters';

export type ExtendedBusiness =
  Extract<TrialBalanceReportQuery['businessTransactionsSumFromLedgerRecords'], {businessTransactionsSum: unknown}>['businessTransactionsSum'][number];

interface Props {
  record: ExtendedBusiness;
  sortCodeId: number;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportBusiness = ({ record, sortCodeId, filter, isAllOpened }: Props) => {
  const [isExtended, setIsExtended] = useState(isAllOpened);
  const rowTotal = record?.total?.raw ?? 0;
  return (
    <>
      <tr key={record.business.id}>
        <td>{sortCodeId}</td>
        <td>{record.business.id}</td>
        <td>{record.business.name ?? undefined}</td>
        <td>
          {rowTotal < -0.001
            ? formatStringifyAmount(-1 * (record.total.raw ?? 0))
            : undefined}
        </td>
        <td>
          {rowTotal > 0.001
            ? formatStringifyAmount(record.total.raw ?? 0)
            : undefined}
        </td>
        <td>{}</td>
        <td>
          <Tooltip label="Detailed records">
            <ActionIcon variant="default" onClick={() => setIsExtended(i => !i)} size={30}>
              {isExtended || isAllOpened ? (
                <LayoutNavbarCollapse size={20} />
              ) : (
                <LayoutNavbarExpand size={20} />
              )}
            </ActionIcon>
          </Tooltip>
        </td>
      </tr>
      {(isExtended || isAllOpened) && (
        <tr>
          <td colSpan={7}>
            <BusinessExtendedInfo businessID={record.business?.id} filter={filter} />
          </td>
        </tr>
      )}
    </>
  );
};
