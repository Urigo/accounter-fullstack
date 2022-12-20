import { useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { BusinessTransactionsFilter, TrialBalanceReportQuery } from '../../../gql/graphql';
import { formatStringifyAmount } from '../../../helpers';
import { BusinessExtendedInfo } from '../../business-transactions/business-extended-info';

export type ExtendedAccount =
  TrialBalanceReportQuery['allSortCodes'][number]['accounts'][number] & {
    transactionsSum?: Extract<
      TrialBalanceReportQuery['businessTransactionsSumFromLedgerRecords'],
      { __typename?: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult' }
    >['businessTransactionsSum'][number];
  };

interface Props {
  account: ExtendedAccount;
  sortCodeId: number;
  filter: BusinessTransactionsFilter;
}

export const TrialBalanceReportAccount = ({ account, sortCodeId, filter }: Props) => {
  const [isExtended, setIsExtended] = useState(false);
  const rowTotal = account.transactionsSum?.total?.raw ?? 0;
  return (
    <>
      <tr key={account.id}>
        <td>{sortCodeId}</td>
        <td>{account.key}</td>
        <td>{account.name ?? undefined}</td>
        <td>
          {rowTotal < -0.001
            ? formatStringifyAmount(-1 * (account.transactionsSum?.total.raw ?? 0))
            : undefined}
        </td>
        <td>
          {rowTotal > 0.001
            ? formatStringifyAmount(account.transactionsSum?.total.raw ?? 0)
            : undefined}
        </td>
        <td>{}</td>
        <td>
          <Tooltip label="Detailed records">
            <ActionIcon variant="default" onClick={() => setIsExtended(i => !i)} size={30}>
              {isExtended ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
            </ActionIcon>
          </Tooltip>
        </td>
      </tr>
      {isExtended && <BusinessExtendedInfo businessName={account.key} filter={filter} />}
    </>
  );
};
