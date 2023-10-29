import { ReactElement } from 'react';
import { AllBusinessesHebrewNameFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllBusinessesHebrewNameFields on LtdFinancialEntity {
    id
    hebrewName
  }
`;

type Props = {
  data: FragmentType<typeof AllBusinessesHebrewNameFieldsFragmentDoc>;
};

export const HebrewName = ({ data }: Props): ReactElement => {
  const business = getFragmentData(AllBusinessesHebrewNameFieldsFragmentDoc, data);

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
