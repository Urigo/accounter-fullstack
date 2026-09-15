import type { ReactElement } from 'react';
import type { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';
import { Badge } from '../../ui/badge.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const TaxExcluded = ({ data }: Props): ReactElement => {
  return data.taxExcluded ? (
    <Badge variant="outline">Tax Excluded</Badge>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
};
