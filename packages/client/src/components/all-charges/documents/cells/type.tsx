import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const DocumentTypeFieldsFragmentDoc = graphql(`
  fragment DocumentTypeFields on Document {
    id
    documentType
  }
`);

type Props = {
  data: FragmentOf<typeof DocumentTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props): ReactElement => {
  const { documentType } = readFragment(DocumentTypeFieldsFragmentDoc, data);
  const isError = !documentType || documentType === 'UNPROCESSED';
  const cellText = documentType ?? 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p>{cellText}</p>
          </Indicator>
        </div>
      </div>
    </td>
  );
};
