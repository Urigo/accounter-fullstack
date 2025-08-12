import type { ReactElement } from 'react';
import type { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const Name = ({ data }: Props): ReactElement => {
  return <td>{data.name}</td>;
};
