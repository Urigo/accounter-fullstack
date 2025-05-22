import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { Text, Tooltip } from '@mantine/core';
import { TrialBalanceTableFieldsFragment } from '../../../gql/graphql.js';
import { BusinessExtendedInfo } from '../../business-transactions/business-extended-info.js';
import { Button } from '../../ui/button.js';
import { TrialBalanceReportFilters } from './trial-balance-report-filters.js';

export type ExtendedBusiness = Extract<
  TrialBalanceTableFieldsFragment,
  { businessTransactionsSum: unknown }
>['businessTransactionsSum'][number];

interface Props {
  record: ExtendedBusiness;
  sortCodeKey: number;
  filter: TrialBalanceReportFilters;
  isAllOpened: boolean;
}

export const TrialBalanceReportBusiness = ({
  record,
  sortCodeKey,
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
        <td>{sortCodeKey}</td>
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
            <Button
              variant="outline"
              size="icon"
              className="size-7.5"
              onClick={(): void => setIsExtended(i => !i)}
            >
              {isExtended || isAllOpened ? (
                <LayoutNavbarCollapse className="size-5" />
              ) : (
                <LayoutNavbarExpand className="size-5" />
              )}
            </Button>
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
