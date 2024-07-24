import { ReactElement } from 'react';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AllTagsNameFieldFragmentDoc } from '../../../gql/graphql.js';
import { TableCell } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllTagsNameField on Tag {
    name
  }
`;

type Props = {
  data: FragmentType<typeof AllTagsNameFieldFragmentDoc>;
};

export const TagName = ({ data }: Props): ReactElement => {
  const tag = getFragmentData(AllTagsNameFieldFragmentDoc, data);

  return (
    <TableCell className="font-medium">{tag.name}</TableCell>
  );
};
