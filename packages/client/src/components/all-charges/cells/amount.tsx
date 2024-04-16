import { ReactElement } from 'react';
import { AllChargesAmountFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

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

export const Amount = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesAmountFieldsFragmentDoc, data);

  return (
    <td>
      <div>
        <p
          className={
            (charge.totalAmount?.raw ?? 0) > 0
              ? 'whitespace-nowrap text-green-700'
              : 'whitespace-nowrap text-red-500'
          }
        >
          {charge.totalAmount?.formatted}
        </p>
      </div>
    </td>
  );
};
