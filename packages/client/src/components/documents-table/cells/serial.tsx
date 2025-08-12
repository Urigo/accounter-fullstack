import type { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Serial = ({ document }: Props): ReactElement => {
  const serialNumber = 'serialNumber' in document ? document.serialNumber : undefined;
  const allocationNumber = 'allocationNumber' in document ? document.allocationNumber : undefined;

  const shouldHaveSerial = DocumentType.Other !== document.documentType;
  const isError = shouldHaveSerial && !serialNumber;

  return (
    <div className="flex flex-col align-center justify-center flex-wrap">
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        <p>{serialNumber}</p>
      </Indicator>
      {allocationNumber && <p className="text-xs">({allocationNumber})</p>}
    </div>
  );
};
