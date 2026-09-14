import { useState, type ReactElement } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import type { TrialBalanceTableFieldsFragment } from '../../../gql/graphql.js';
import { BusinessExtendedInfo } from '../../business-ledger/business-extended-info.js';
import { Tooltip } from '../../common/index.js';
import { Button } from '../../ui/button.js';
import { TableCell, TableRow } from '../../ui/table.js';
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
      <TableRow key={record.business.id}>
        <TableCell>{sortCodeKey}</TableCell>
        <TableCell>{record.business.id}</TableCell>
        <TableCell>{record.business.name ?? undefined}</TableCell>
        <TableCell>{rowDebit ? record?.debit?.formatted : undefined}</TableCell>
        <TableCell>{rowCredit ? record?.credit?.formatted : undefined}</TableCell>
        <TableCell>
          {(rowTotal > 0.001 || rowTotal < -0.001) && (
            <div className={rowTotal > 0 ? 'text-green-500' : 'text-red-500'}>
              {record?.total?.formatted}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Tooltip content="Detailed records">
            <Button
              variant="outline"
              size="icon"
              className="size-7.5"
              onClick={(): void => setIsExtended(i => !i)}
            >
              {isExtended || isAllOpened ? (
                <PanelTopClose className="size-5" />
              ) : (
                <PanelTopOpen className="size-5" />
              )}
            </Button>
          </Tooltip>
        </TableCell>
      </TableRow>
      {(isExtended || isAllOpened) && (
        <TableRow>
          <TableCell colSpan={7}>
            <BusinessExtendedInfo businessID={record.business?.id} filter={filter} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
