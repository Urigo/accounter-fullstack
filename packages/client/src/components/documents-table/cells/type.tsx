import type { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { getDocumentNameFromType } from '../../../helpers/index.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
  isOpen: boolean;
};

export const TypeCell = ({ document: { documentType }, isOpen }: Props): ReactElement => {
  const isError = !documentType || documentType === DocumentType.Unprocessed;
  const cellText = documentType ?? DocumentType.Unprocessed;
  const color = isError ? 'red' : isOpen ? 'orange' : 'blue';

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <Indicator inline size={12} disabled={!isError && !isOpen} color={color} zIndex="auto">
          <p>{getDocumentNameFromType(cellText)}</p>
        </Indicator>
      </div>
    </div>
  );
};
