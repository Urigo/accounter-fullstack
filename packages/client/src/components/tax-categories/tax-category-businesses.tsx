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
    <ul className="flex flex-col gap-1 py-1 pl-8">
      {businesses.map(business => (
        <li key={business.id}>
          <Link
            to={ROUTES.BUSINESSES.DETAIL(business.id)}
            state={{ from: ROUTES.TAX_CATEGORIES }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {business.name}
          </Link>
        </li>
      ))}
    </ul>
  );
};
