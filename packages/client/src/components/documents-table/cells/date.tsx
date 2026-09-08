import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { DocumentType } from '../../../gql/graphql.js';
import { Indicator } from '../../ui/indicator.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const DateCell = ({ document }: Props): ReactElement => {
  const date = 'date' in document ? document.date : undefined;

  const shouldHaveDate = DocumentType.Other !== document.documentType;
  const isError = shouldHaveDate && !date;

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';
  const dateContentValue = shouldHaveDate ? formattedDate : null;

  return (
    <Indicator inline size={12} disabled={!isError} color="red">
      <div>{dateContentValue}</div>
    </Indicator>
  );
};
