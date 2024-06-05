import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';

export const TransactionsTableAmountFieldsFragmentDoc = graphql(`
  fragment TransactionsTableAmountFields on Transaction {
    id
    amount {
      raw
      formatted
    }
    cryptoExchangeRate {
      rate
    }
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableAmountFieldsFragmentDoc, data);
  const amount = 'amount' in transaction ? transaction.amount : undefined;

  return (
    <td>
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
    </td>
  );
};
