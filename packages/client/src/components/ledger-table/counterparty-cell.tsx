import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';

type Props = {
  account?: {
    name: string;
    id: string;
  } | null;
  diffAccount?: {
    name: string;
    id: string;
  } | null;
};

export const CounterpartyCell = ({ account, diffAccount }: Props): ReactElement => {
  const isAccountDiff = diffAccount && diffAccount?.id !== account?.id;

  return (
    <div className="flex flex-col whitespace-normal">
      {(account || isAccountDiff) && (
        <>
          {account && (
            <Link
              to={ROUTES.BUSINESSES.DETAIL(account.id)}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className={`inline-flex items-center font-semibold ${isAccountDiff ? 'line-through' : ''}`}
            >
              {account.name}
            </Link>
          )}
          {isAccountDiff && diffAccount && (
            <div className="border-2 border-yellow-500 rounded-md">
              <Link
                to={ROUTES.BUSINESSES.DETAIL(diffAccount.id)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="inline-flex items-center font-semibold"
              >
                {diffAccount.name}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};
