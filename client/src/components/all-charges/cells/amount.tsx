import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesAmountFieldsFragmentDoc } from '../../../gql/graphql';

/* GraphQL */ `
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
  data: FragmentType<typeof AllChargesAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesAmountFieldsFragmentDoc, data);
  const { amount } = charge.transactions[0];

  return <div style={{ color: Number(amount.raw) > 0 ? 'green' : 'red' }}>{amount.formatted}</div>;
};
