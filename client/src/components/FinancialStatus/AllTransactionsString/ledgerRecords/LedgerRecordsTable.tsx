import { FC } from 'react';
import { LedgerRecordRow } from './LedgerRecordRow';
import { LedgerRecordsFragment } from '../../../../__generated__/types';

type Props = {
  ledgerRecords: LedgerRecordsFragment['ledgerRecords'];
};

export const LedgerRecordsTable: FC<Props> = ({ ledgerRecords }) => {
  return (
    <table>
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
    </table>
  );
};
