import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

type Props = {
  counterAccount?: {
    id: string;
    name: string;
    __typename?: string;
  } | null;
};

export const CounterAccountCell = ({ counterAccount }: Props): ReactElement => {
  if (!counterAccount) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <Link
      to={ROUTES.BUSINESSES.DETAIL(counterAccount.id)}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      className="inline-flex items-center font-semibold whitespace-nowrap text-sm"
    >
      {counterAccount.name}
    </Link>
  );
};
