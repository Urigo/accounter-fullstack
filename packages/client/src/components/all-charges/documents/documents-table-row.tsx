import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { FragmentOf, graphql, readFragment, ResultOf } from '../../../graphql.js';
import { EditMiniButton } from '../../common/index.js';
import {
  Amount,
  Creditor,
  DateCell,
  Debtor,
  DocumentFilesFieldsFragmentDoc,
  DocumentsDateFieldsFragmentDoc,
  DocumentSerialFieldsFragmentDoc,
  DocumentsTableAmountFieldsFragmentDoc,
  DocumentsTableCreditorFieldsFragmentDoc,
  DocumentsTableDebtorFieldsFragmentDoc,
  DocumentsTableVatFieldsFragmentDoc,
  DocumentTypeFieldsFragmentDoc,
  Files,
  Serial,
  TypeCell,
  Vat,
} from './cells/index.js';

export const TableDocumentsRowFieldsFragmentDoc = graphql(
  `
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
  `,
  [
    DocumentsTableAmountFieldsFragmentDoc,
    DocumentsDateFieldsFragmentDoc,
    DocumentsTableVatFieldsFragmentDoc,
    DocumentTypeFieldsFragmentDoc,
    DocumentSerialFieldsFragmentDoc,
    DocumentsTableCreditorFieldsFragmentDoc,
    DocumentsTableDebtorFieldsFragmentDoc,
    DocumentFilesFieldsFragmentDoc,
  ],
);

type TableDocumentsRowFieldsFragment = ResultOf<typeof TableDocumentsRowFieldsFragmentDoc>;

export const DocumentTableRowDocument = graphql(
  `
    query DocumentTableRow($documentId: UUID!) {
      documentById(documentId: $documentId) {
        id
        ...TableDocumentsRowFields
      }
    }
  `,
  [TableDocumentsRowFieldsFragmentDoc],
);

type Props = {
  documentData: FragmentOf<typeof TableDocumentsRowFieldsFragmentDoc>;
  editDocument: () => void;
  onChange?: () => void;
};

export const DocumentsTableRow = ({
  documentData,
  editDocument,
  onChange,
}: Props): ReactElement => {
  const [document, setDocument] = useState<TableDocumentsRowFieldsFragment>(
    readFragment(TableDocumentsRowFieldsFragmentDoc, documentData),
  );

  const [{ data: newData }, fetchDocument] = useQuery({
    query: DocumentTableRowDocument,
    pause: true,
    variables: {
      documentId: document.id,
    },
  });

  const refetchDocument = useCallback(() => {
    if (onChange) {
      onChange();
    } else {
      fetchDocument();
    }
  }, [fetchDocument, onChange]);

  useEffect(() => {
    const updatedDocument = newData?.documentById;
    if (updatedDocument) {
      setDocument(readFragment(TableDocumentsRowFieldsFragmentDoc, updatedDocument));
    }
  }, [newData]);

  useEffect(() => {
    setDocument(readFragment(TableDocumentsRowFieldsFragmentDoc, documentData));
  }, [documentData]);

  return (
    <tr key={document.id}>
      <DateCell data={document} />
      <Amount data={document} refetchDocument={refetchDocument} />
      <Vat data={document} />
      <TypeCell data={document} />
      <Serial data={document} />
      <Creditor data={document} refetchDocument={refetchDocument} />
      <Debtor data={document} refetchDocument={refetchDocument} />
      <Files data={document} />
      <td>
        <EditMiniButton onClick={editDocument} tooltip="Edit Document" />
      </td>
    </tr>
  );
};
