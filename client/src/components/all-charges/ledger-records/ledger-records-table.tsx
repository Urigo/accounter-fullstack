import { LedgerRecords } from './ledger-record-row';
import { LedgerRecordsFieldsFragment } from '../../../__generated__/types';
import { AccounterBasicTable } from '../../common/accounter-basic-table';

type Props = {
  ledgerRecords: LedgerRecordsFieldsFragment['ledgerRecords'];
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
              <LedgerRecords key={r.id} ledgerRecord={r} />
            ))}
          </tbody>
        </>
      }
    />
  );
};
