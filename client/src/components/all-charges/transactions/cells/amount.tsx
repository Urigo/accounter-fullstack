import { ReactElement } from 'react';
import { TransactionsTableAmountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
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
`;

type Props = {
  data: FragmentType<typeof TransactionsTableAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props): ReactElement => {
  const transaction = getFragmentData(TransactionsTableAmountFieldsFragmentDoc, data);
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
        <br/>
        {transaction.cryptoExchangeRate && (
          <span
            style={{
              color: 'gray',
              marginLeft: '0.5rem',
            }}
          >
            {`(${transaction.cryptoExchangeRate.rate})`}
          </span>
        )}
      </div>
    </td>
  );
};
