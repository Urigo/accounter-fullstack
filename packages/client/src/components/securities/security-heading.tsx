import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  name: string;
  symbol?: string | null;
  hebName?: string | null;
  /** Where the name links to; plain text when unset. */
  href?: string;
  /** The descriptor badges row. */
  children?: ReactNode;
}

/**
 * A security's name, symbol, Hebrew name and badges, shared by its own page and the charge panel
 * so the two always read the same.
 */
export function SecurityHeading({ name, symbol, hebName, href, children }: Props): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-lg font-semibold">
        {href ? (
          <Link to={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
        {symbol && <span className="text-gray-500"> ({symbol})</span>}
      </div>
      {hebName && <div className="text-sm text-gray-500">{hebName}</div>}
      {children}
    </div>
  );
}
