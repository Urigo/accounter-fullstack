import { ReactElement } from 'react';
import { TransactionsTableRowType } from '../columns';

type Props = {
  transaction: TransactionsTableRowType;
};

export const Account = ({ transaction }: Props): ReactElement => {
  const { account } = transaction;

  const accountType = account.type;
  const accountName = account.name;

  return (
    <div className="flex flex-col gap-2 items-center">
      <p>{accountType}</p>
      <p>{accountName}</p>
    </div>
  );
};
