import { ReactElement } from 'react';
import { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const SortCode = ({ data }: Props): ReactElement => {
  return (
    <td>
      {data.sortCode ? (
        <span>
          {data.sortCode?.name} ({data.sortCode?.id})
        </span>
      ) : (
        'N/A'
      )}
    </td>
  );
};
