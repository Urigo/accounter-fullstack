import { ReactElement } from 'react';
import { AllBusinessesNameFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllBusinessesNameFields on LtdFinancialEntity {
    id
    name
  }
`;

type Props = {
  data: FragmentType<typeof AllBusinessesNameFieldsFragmentDoc>;
};

export const Name = ({ data }: Props): ReactElement => {
  const business = getFragmentData(AllBusinessesNameFieldsFragmentDoc, data);

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
