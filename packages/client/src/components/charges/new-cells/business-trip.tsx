import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

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
