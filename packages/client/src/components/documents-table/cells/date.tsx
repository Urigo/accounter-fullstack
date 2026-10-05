import type { ReactElement } from 'react';
import { DocumentType } from '../../../gql/graphql.js';
import { formatTimelessDate } from '../../../helpers/index.js';
import { Indicator } from '../../ui/indicator.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const DateCell = ({ document }: Props): ReactElement => {
  const date = 'date' in document ? document.date : undefined;

  const shouldHaveDate = DocumentType.Other !== document.documentType;
  const isError = shouldHaveDate && !date;

  const formattedDate = date ? formatTimelessDate(date) : 'Missing Data';
  const dateContentValue = shouldHaveDate ? formattedDate : null;

  return (
    <Indicator inline size={12} disabled={!isError} color="red">
      <div>{dateContentValue}</div>
    </Indicator>
  );
};
