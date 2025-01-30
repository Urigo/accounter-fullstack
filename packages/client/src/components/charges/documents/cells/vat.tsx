import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentsTableVatFieldsFragmentDoc, DocumentType } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsTableVatFields on Document {
    id
    documentType
    ... on FinancialDocument {
      vat {
        raw
        formatted
        currency
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsTableVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props): ReactElement => {
  const document = getFragmentData(DocumentsTableVatFieldsFragmentDoc, data);
  const vat = 'vat' in document ? document.vat : undefined;

  const shouldHaveVat = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveVat && vat?.formatted == null;

  return (
    <td>
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
    </td>
  );
};
