import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const DateCell = ({ document }: Props): ReactElement => {
  const date = 'date' in document ? document.date : undefined;

  const shouldHaveDate = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveDate && !date;

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';
  const dateContentValue = shouldHaveDate ? formattedDate : null;

  return (
    <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
      <div>{dateContentValue}</div>
    </Indicator>
  );
};
