import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const TypeCell = ({ document: { documentType } }: Props): ReactElement => {
  const isError = !documentType || documentType === DocumentType.Unprocessed;
  const cellText = documentType ?? 'Missing';

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          <p>{cellText}</p>
        </Indicator>
      </div>
    </div>
  );
};
