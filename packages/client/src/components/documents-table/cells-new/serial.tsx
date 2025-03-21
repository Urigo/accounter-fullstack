import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Serial = ({ document }: Props): ReactElement => {
  const serialNumber = 'serialNumber' in document ? document.serialNumber : undefined;

  const shouldHaveSerial = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveSerial && !serialNumber;

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          <p>{serialNumber}</p>
        </Indicator>
      </div>
    </div>
  );
};
