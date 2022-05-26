import { LedgerRecordRow } from './LedgerRecordRow';
import { LedgerRecordsFragment } from '../../../../__generated__/types';
import { AccounterBasicTable } from '../../../common/AccounterBasicTable';

type Props = {
  ledgerRecords: LedgerRecordsFragment['ledgerRecords'];
};

export const LedgerRecordsTable = ({ ledgerRecords }: Props) => {
  return (
    <AccounterBasicTable
      content={
        <>
          <thead>
            <tr>
              <th>creditAccount</th>
              <th>debitAccount</th>
              <th>localCurrencyAmount</th>
              <th>originalAmount</th>
              <th>date</th>
              <th>accountantApproval</th>
              <th>hashavshevetId</th>
              <th>description</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRecords.map(r => (
              <LedgerRecordRow ledgerRecord={r} />
            ))}
          </tbody>
        </>
      }
    />
  );
};
