import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import { ChargesTableBusinessTripFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';

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
      <Link
        to={
          charge.businessTrip?.id
            ? ROUTES.BUSINESS_TRIPS.DETAIL(charge.businessTrip?.id)
            : ROUTES.BUSINESS_TRIPS.ROOT
        }
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="inline-flex items-center font-semibold"
      >
        {charge.businessTrip?.name}
      </Link>
    </td>
  );
};
