import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Vat = ({ document }: Props): ReactElement => {
  const vat = 'vat' in document ? document.vat : undefined;

  const shouldHaveVat = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveVat && vat?.formatted == null;

  return (
    <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
      <div
        style={{
          color: Number(vat?.raw) > 0 ? 'green' : 'red',
          whiteSpace: 'nowrap',
        }}
      >
        {vat?.formatted}
      </div>
    </Indicator>
  );
};
