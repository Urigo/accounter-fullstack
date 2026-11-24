import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

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

export type BusinessTripProps = {
  id: string;
  name: string;
};

export const BusinessTrip = ({ id, name }: BusinessTripProps): ReactElement => {
  return (
    <Link
      to={id ? ROUTES.BUSINESS_TRIPS.DETAIL(id) : ROUTES.BUSINESS_TRIPS.ROOT}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      className="inline-flex items-center font-semibold"
    >
      {name}
    </Link>
  );
};
