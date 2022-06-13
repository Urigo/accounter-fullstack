import { LedgerRecordRow } from './ledger-record-row';
import { LedgerRecordsFragment } from '../../../../__generated__/types';
import { AccounterBasicTable } from '../../../common/accounter-basic-table';

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
