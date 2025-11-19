import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

type Props = {
  business: {
    id: string;
    name: string;
  };
};

export const BusinessNameCell = ({ business }: Props): ReactElement => {
  return (
    <Link
      to={ROUTES.BUSINESSES.DETAIL(business.id)}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      className="inline-flex items-center font-semibold whitespace-nowrap"
    >
      {business.name}
    </Link>
  );
};
