import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import type { AllTaxCategoriesForScreenQuery } from '../../gql/graphql.js';

type Business = AllTaxCategoriesForScreenQuery['taxCategories'][number]['businesses'][number];

interface Props {
  businesses: readonly Business[];
}

/** Expanded-row content: the businesses this tax category is the default for. */
export const TaxCategoryBusinesses = ({ businesses }: Props): ReactElement => {
  if (businesses.length === 0) {
    return <span className="text-sm text-muted-foreground">No businesses use this default</span>;
  }

  return (
    // `list-outside` markers keep a wrapped long name indented under its own
    // first line, so a line break cannot be mistaken for the next business.
    <ul className="list-disc list-outside space-y-1 py-1 pl-12 marker:text-muted-foreground">
      {businesses.map(business => (
        <li key={business.id} className="pl-1">
          <Link
            to={ROUTES.BUSINESSES.DETAIL(business.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {business.name}
          </Link>
        </li>
      ))}
    </ul>
  );
};
