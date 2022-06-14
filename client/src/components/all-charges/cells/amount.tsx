import { CSSProperties } from 'react';
import gql from 'graphql-tag';

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
