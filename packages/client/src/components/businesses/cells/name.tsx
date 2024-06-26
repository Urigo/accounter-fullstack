import { ReactElement } from 'react';
import { graphql } from '../../../graphql.js';

export const AllBusinessesNameFieldsFragmentDoc = graphql(`
  fragment AllBusinessesNameFields on LtdFinancialEntity {
    id
    name
  }
`);

type Props = {
  data: FragmentOf<typeof AllBusinessesNameFieldsFragmentDoc>;
};

export const Name = ({ data }: Props): ReactElement => {
  const business = readFragment(AllBusinessesNameFieldsFragmentDoc, data);

  return (
    <td>
      <div
        style={{
          whiteSpace: 'nowrap',
        }}
      >
        {business.name}
      </div>
    </td>
  );
};
