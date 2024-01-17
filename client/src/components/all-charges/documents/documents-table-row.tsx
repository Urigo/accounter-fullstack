import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import {
  DocumentTableRowDocument,
  TableDocumentsRowFieldsFragment,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EditMiniButton } from '../../common';
import { Amount, Creditor, DateCell, Debtor, Files, Serial, TypeCell, Vat } from './cells';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsRowFields on Document {
    id
    ...DocumentsTableAmountFields
    ...DocumentsDateFields
    ...DocumentsTableVatFields
    ...DocumentTypeFields
    ...DocumentSerialFields
    ...DocumentsTableCreditorFields
    ...DocumentsTableDebtorFields
    ...DocumentFilesFields
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query DocumentTableRow($documentId: UUID!) {
    documentById(documentId: $documentId) {
      id
      ...TableDocumentsRowFields
    }
  }
`;

type Props = {
  documentData: FragmentType<typeof TableDocumentsRowFieldsFragmentDoc>;
  editDocument: () => void;
};

export const DocumentsTableRow = ({ documentData, editDocument }: Props): ReactElement => {
  const [document, setDocument] = useState<TableDocumentsRowFieldsFragment>(
    getFragmentData(TableDocumentsRowFieldsFragmentDoc, documentData),
  );

  const [{ data: newData }, fetchDocument] = useQuery({
    query: DocumentTableRowDocument,
    pause: true,
    variables: {
      documentId: document.id,
    },
  });

  const refetchDocument = useCallback(() => {
    fetchDocument();
  }, [fetchDocument]);

  useEffect(() => {
    const updatedDocument = newData?.documentById;
    if (updatedDocument) {
      setDocument(getFragmentData(TableDocumentsRowFieldsFragmentDoc, updatedDocument));
    }
  }, [newData]);

  return (
    <tr key={document.id}>
      <DateCell data={document} />
      <Amount data={document} refetchDocument={(): void => refetchDocument()} />
      <Vat data={document} />
      <TypeCell data={document} />
      <Serial data={document} />
      <Creditor data={document} refetchDocument={(): void => refetchDocument()} />
      <Debtor data={document} refetchDocument={(): void => refetchDocument()} />
      <Files data={document} />
      <td>
        <EditMiniButton onClick={editDocument} tooltip="Edit Document" />
      </td>
    </tr>
  );
};
