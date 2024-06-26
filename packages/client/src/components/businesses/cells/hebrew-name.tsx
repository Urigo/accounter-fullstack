import { ReactElement } from 'react';
import { graphql } from '../../../graphql.js';

export const AllBusinessesHebrewNameFieldsFragmentDoc = graphql(`
  fragment AllBusinessesHebrewNameFields on LtdFinancialEntity {
    id
    hebrewName
  }
`);

type Props = {
  data: FragmentOf<typeof AllBusinessesHebrewNameFieldsFragmentDoc>;
};

export const HebrewName = ({ data }: Props): ReactElement => {
  const business = readFragment(AllBusinessesHebrewNameFieldsFragmentDoc, data);

  return (
    <td>
      <div
        style={{
          whiteSpace: 'nowrap',
        }}
      >
        {business.hebrewName}
      </div>
    </td>
  );
};
