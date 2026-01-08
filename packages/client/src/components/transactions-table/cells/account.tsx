import type { ReactElement } from 'react';
import { Tooltip } from '@/components/common/tooltip.js';
import { getAccountIcon, getAccountTypeLabel } from '../../financial-accounts/utils.js';
import type { TransactionsTableRowType } from '../columns';

type Props = {
  transaction: TransactionsTableRowType;
};

export const Account = ({ transaction }: Props): ReactElement => {
  const { account } = transaction;

  const accountIcon = getAccountIcon(account.type);
  const accountType = getAccountTypeLabel(account.type);
  const accountName = account.name;

  return (
    <div className="flex flex-col justify-center">
      <p>
        <Tooltip content={accountType}>{accountIcon}</Tooltip>
      </p>
      <p>{accountName}</p>
    </div>
  );
};
