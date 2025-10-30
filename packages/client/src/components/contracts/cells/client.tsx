import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

type Props = {
  id: string;
  name: string;
};

export function Client({ id, name }: Props): ReactElement {
  return (
    <div className="flex flex-wrap flex-col justify-center">
      <Link
        to={ROUTES.BUSINESSES.DETAIL(id)}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="inline-flex items-center font-semibold"
      >
        {name}
      </Link>
    </div>
  );
}
