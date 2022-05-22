import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';

gql`
  fragment AmountFields on Charge {
    transactions {
      amount {
        formatted
      }
    }
  }
`;

type Props = {
  amount: string;
  style?: CSSProperties;
};

export const Amount: FC<Props> = ({ amount, style }) => {
  return <td style={{ ...style }}>{amount}</td>;
};
