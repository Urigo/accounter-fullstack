import type { ReactElement } from 'react';
import type { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const SortCode = ({ data }: Props): ReactElement => {
  const { sortCode } = data;
  if (!sortCode) {
    return <span className="text-muted-foreground">N/A</span>;
  }
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium">{sortCode.key}</span>
      {sortCode.name && <span className="text-xs text-muted-foreground">{sortCode.name}</span>}
    </div>
  );
};
