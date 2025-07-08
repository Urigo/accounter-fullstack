import { ReactElement, useMemo } from 'react';
import { ThemeIcon } from '@mantine/core';
import { ChargesTableTypeFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { getChargeTypeIcon, getChargeTypeName } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableTypeFields on Charge {
    __typename
    id
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(ChargesTableTypeFieldsFragmentDoc, data);
  const { __typename } = charge;

  const { text, icon } = useMemo(
    (): {
      text: string;
      icon: ReactElement;
    } => ({
      text: getChargeTypeName(__typename),
      icon: getChargeTypeIcon(__typename),
    }),
    [__typename],
  );
  return (
    <td>
      <div>{text}</div>
      <ThemeIcon radius="xl" size="xl">
        {icon}
      </ThemeIcon>
    </td>
  );
};
