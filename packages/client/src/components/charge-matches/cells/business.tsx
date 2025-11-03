import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

type Props = {
  business: {
    id?: string;
    name?: string;
  };
};

export const Business = ({ business }: Props): ReactElement => {
  return business.id ? (
    <Link
      to={ROUTES.BUSINESSES.DETAIL(business.id)}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      className="inline-flex items-center font-semibold"
    >
      {business.name}
    </Link>
  ) : (
    <div />
  );
};
