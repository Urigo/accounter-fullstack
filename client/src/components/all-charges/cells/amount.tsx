import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesAmountFieldsFragmentDoc } from '../../../gql/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesAmountFields on Charge {
    id
    totalAmount {
        raw
        formatted
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesAmountFieldsFragmentDoc, data);

  return (
    <td>
      <div
        style={{
          color: Number(charge.totalAmount?.raw) > 0 ? 'green' : 'red',
          whiteSpace: 'nowrap',
        }}
      >
        {charge.totalAmount?.formatted}
      </div>
    </td>
  );
};
