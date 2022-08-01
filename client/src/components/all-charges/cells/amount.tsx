import gql from 'graphql-tag';

import { AllChargesAmountFieldsFragment } from '../../../__generated__/types';

gql`
  fragment AllChargesAmountFields on Charge {
    id
    transactions {
      id
      amount {
        raw
        formatted
      }
    }
  }
`;

type Props = {
  data: AllChargesAmountFieldsFragment['transactions']['0'];
};

export const Amount = ({ data }: Props) => {
  const { amount } = data;

  return <div style={{ color: Number(amount.raw) > 0 ? 'green' : 'red' }}>{amount.formatted}</div>;
};
