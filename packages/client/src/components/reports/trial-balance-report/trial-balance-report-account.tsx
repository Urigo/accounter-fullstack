import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Text, Tooltip } from '@mantine/core';
import { TrialBalanceReportQuery } from '../../../gql/graphql.js';
import { BusinessExtendedInfo } from '../../business-transactions/business-extended-info.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';

export type ExtendedBusiness = Extract<
  TrialBalanceReportQuery['businessTransactionsSumFromLedgerRecords'],
  { businessTransactionsSum: unknown }
>['businessTransactionsSum'][number];

interface Props {
  record: ExtendedBusiness;
  sortCodeId: number;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportBusiness = ({
  record,
  sortCodeId,
  filter,
  isAllOpened,
}: Props): ReactElement => {
  const [isExtended, setIsExtended] = useState(isAllOpened);
  const rowTotal = record?.total?.raw ?? 0;
  const rowDebit = record?.debit?.raw ?? 0;
  const rowCredit = record?.credit?.raw ?? 0;
  return (
    <>
      <tr key={record.business.id}>
        <td>{sortCodeId}</td>
        <td>{record.business.id}</td>
        <td>{record.business.name ?? undefined}</td>
        <td>{rowDebit ? record?.debit?.formatted : undefined}</td>
        <td>{rowCredit ? record?.credit?.formatted : undefined}</td>
        <td>
          {(rowTotal > 0.001 || rowTotal < -0.001) && (
            <Text color={rowTotal > 0 ? 'green' : 'red'}>{record?.total?.formatted}</Text>
          )}
        </td>
        <td>
          <Tooltip label="Detailed records">
            <ActionIcon variant="default" onClick={(): void => setIsExtended(i => !i)} size={30}>
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
