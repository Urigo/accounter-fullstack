import type { ReactElement } from 'react';
import type { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const IrsCode = ({ data }: Props): ReactElement => {
  return data.irsCode == null ? (
    <span className="text-muted-foreground">N/A</span>
  ) : (
    <span>{data.irsCode}</span>
  );
};
