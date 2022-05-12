import { FC } from 'react';

type Props = {
  ledgerRecord: any;
};

export const LedgerRecordRow: FC<Props> = ({ ledgerRecord }) => {
  return (
    <tr>
      <td>{ledgerRecord.creditAccount?.name}</td>
      <td>{ledgerRecord.debitAccount?.name}</td>
      <td>{ledgerRecord.localCurrencyAmount?.formatted}</td>
      <td>{ledgerRecord.originalAmount?.formatted}</td>
      <td>{ledgerRecord.date}</td>
      <td>{ledgerRecord.accountantApproval?.approved}</td>
      <td>{ledgerRecord.hashavshevetId}</td>
      <td>{ledgerRecord.description}</td>
    </tr>
  );
};
