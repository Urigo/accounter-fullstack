import { ReactElement } from 'react';
import { NavLink } from '@mantine/core';
import { ChargesTableBusinessTripFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableBusinessTripFields on Charge {
    id
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableBusinessTripFieldsFragmentDoc>;
};

export const BusinessTrip = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(ChargesTableBusinessTripFieldsFragmentDoc, data);

  if (!('businessTrip' in charge)) {
    return <td />;
  }

  return (
    <td>
      <a
        href={`/business-trips/${charge.businessTrip?.id}`}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
      >
        <NavLink
          label={charge.businessTrip?.name}
          className="[&>*>.mantine-NavLink-label]:font-semibold"
        />
      </a>
    </td>
  );
};
