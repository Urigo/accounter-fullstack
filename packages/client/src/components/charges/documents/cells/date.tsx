import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Indicator } from '@mantine/core';
import { DocumentsDateFieldsFragmentDoc, DocumentType } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsDateFields on Document {
    id
    documentType
    ... on FinancialDocument {
      date
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsDateFieldsFragmentDoc>;
};

export const DateCell = ({ data }: Props): ReactElement => {
  const document = getFragmentData(DocumentsDateFieldsFragmentDoc, data);
  const date = 'date' in document ? document.date : undefined;

  const shouldHaveDate = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveDate && !date;

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';
  const dateContentValue = shouldHaveDate ? formattedDate : null;

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        <div>{dateContentValue}</div>
      </Indicator>
    </td>
  );
};
