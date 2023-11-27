import { ReactElement, useMemo } from 'react';
import { AllChargesTypeFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTypeFields on Charge {
    __typename
    id
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesTypeFieldsFragmentDoc, data);
  const { __typename } = charge;

  const type = useMemo(() => {
    switch (__typename) {
      case 'CommonCharge':
        return 'Common';
      // case 'BusinessTripCharge':
      //   return 'Business Trip';
      // case 'DividendCharge':
      //   return 'Dividend';
      case 'ConversionCharge':
        return 'Conversion';
      case 'SalaryCharge':
        return 'Salary';
      case 'InternalTransferCharge':
        return 'Internal Transfer';
    }
  }, [__typename]);
  return (
    <td>
      <div>{type}</div>
    </td>
  );
};
