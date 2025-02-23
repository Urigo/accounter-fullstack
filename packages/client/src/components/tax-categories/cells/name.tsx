import { ReactElement } from 'react';
import { AllTaxCategoriesForScreenQuery } from '../../../gql/graphql.js';

interface Props {
  data: AllTaxCategoriesForScreenQuery['taxCategories'][number];
}

export const Name = ({ data }: Props): ReactElement => {
  return <td>{data.name}</td>;
};
