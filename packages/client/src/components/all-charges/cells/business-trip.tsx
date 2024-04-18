import { ReactElement } from 'react';
import { NavLink } from '@mantine/core';
import { AllChargesBusinessTripFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesBusinessTripFields on Charge {
    id
    businessTrip {
      id
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesBusinessTripFieldsFragmentDoc>;
};

export const BusinessTrip = ({ data }: Props): ReactElement => {
  const { businessTrip } = getFragmentData(AllChargesBusinessTripFieldsFragmentDoc, data);

  return (
    <td>
      <a
        href={`/business-trips/${businessTrip?.id}`}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
      >
        <NavLink
          label={businessTrip?.name}
          className="[&>*>.mantine-NavLink-label]:font-semibold"
        />
      </a>
    </td>
  );
};
