import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentSerialFieldsFragmentDoc, DocumentType } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentSerialFields on Document {
    id
    documentType
    ... on FinancialDocument {
      serialNumber
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentSerialFieldsFragmentDoc>;
};

export const Serial = ({ data }: Props): ReactElement => {
  const document = getFragmentData(DocumentSerialFieldsFragmentDoc, data);
  const serialNumber = 'serialNumber' in document ? document.serialNumber : undefined;

  const shouldHaveSerial = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveSerial && !serialNumber;

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p>{serialNumber}</p>
          </Indicator>
        </div>
      </div>
    </td>
  );
};
