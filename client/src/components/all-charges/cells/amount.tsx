import gql from 'graphql-tag';
import { CSSProperties } from 'react';

gql`
  fragment AmountFields on Charge {
    transactions {
      id
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

export const Amount = ({ amount, style }: Props) => {
  return <td style={{ ...style }}>{amount}</td>;
};
