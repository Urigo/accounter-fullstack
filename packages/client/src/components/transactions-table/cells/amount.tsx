import type { ReactElement } from 'react';
import { formatStringifyAmount } from '../../../helpers/index.js';
import type { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const Amount = ({ transaction }: Props): ReactElement => {
  const amount = 'amount' in transaction ? transaction.amount : undefined;

  return (
    <div
      style={{
        color: Number(amount?.raw) > 0 ? 'green' : 'red',
        whiteSpace: 'nowrap',
      }}
    >
      {amount?.formatted}
      <br />
      {transaction.cryptoExchangeRate && (
        <span
          style={{
            color: 'gray',
            marginLeft: '0.5rem',
          }}
        >
          {`(Rate: ${transaction.cryptoExchangeRate.rate})`}
          <br />
          {amount?.raw
            ? `${formatStringifyAmount(amount.raw * transaction.cryptoExchangeRate.rate)}$`
            : null}
        </span>
      )}
    </div>
  );
};
