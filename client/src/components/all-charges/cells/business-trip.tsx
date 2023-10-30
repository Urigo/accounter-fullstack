import { ReactElement } from 'react';
import { AllChargesBusinessTripFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesBusinessTripFields on Charge {
    id
    businessTrip {
        name
        dates {
            start
            end
        }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesBusinessTripFieldsFragmentDoc>;
};

export const BusinessTrip = ({ data }: Props): ReactElement => {
  const { businessTrip } = getFragmentData(AllChargesBusinessTripFieldsFragmentDoc, data);

  return <td>{businessTrip?.name}</td>;
};
