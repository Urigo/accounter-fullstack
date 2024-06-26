import { ReactElement } from 'react';
import { NavLink } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';

export const AllChargesBusinessTripFieldsFragmentDoc = graphql(`
  fragment AllChargesBusinessTripFields on Charge {
    id
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
  }
`);

type Props = {
  data: FragmentOf<typeof AllChargesBusinessTripFieldsFragmentDoc>;
};

export const BusinessTrip = ({ data }: Props): ReactElement => {
  const charge = readFragment(AllChargesBusinessTripFieldsFragmentDoc, data);

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
