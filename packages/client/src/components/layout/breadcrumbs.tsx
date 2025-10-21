import { Fragment, type ReactElement } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, useMatches } from 'react-router-dom';

interface RouteHandle {
  breadcrumb?: string | ((data?: unknown) => string);
  title?: string | ((data?: unknown) => string);
  [key: string]: unknown;
}

interface Crumb {
  title: string;
  path: string;
  isLast: boolean;
}

/**
 * Breadcrumbs component - displays navigation path
 * Reads breadcrumb data from route handles
 */
export function Breadcrumbs(): ReactElement {
  const matches = useMatches();

  // Build breadcrumb trail from matched routes
  const crumbs: Crumb[] = matches
    .filter(match => {
      const handle = match.handle as RouteHandle | undefined;
      return handle?.breadcrumb;
    })
    .map((match, index, array) => {
      const handle = match.handle as RouteHandle;
      const title =
        typeof handle.breadcrumb === 'function'
          ? handle.breadcrumb(match.data)
          : handle.breadcrumb || 'Page';

      return {
        title,
        path: match.pathname,
        isLast: index === array.length - 1,
      };
    });

  // Don't render if no breadcrumbs
  if (crumbs.length === 0) {
    return <div className="h-8" />; // Spacer to maintain layout
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm text-gray-600">
      {/* Home icon as first item */}
      <Link
        to="/"
        className="flex items-center hover:text-gray-900 transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>

      {/* Breadcrumb items */}
      {crumbs.map((crumb, index) => (
        <Fragment key={`${crumb.path}-${index}`}>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {crumb.isLast ? (
            <span className="font-medium text-gray-900" aria-current="page">
              {crumb.title}
            </span>
          ) : (
            <Link to={crumb.path} className="hover:text-gray-900 transition-colors">
              {crumb.title}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
