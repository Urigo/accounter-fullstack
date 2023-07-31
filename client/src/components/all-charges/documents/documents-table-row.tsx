import { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  DocumentTableRowDocument,
  TableDocumentsRowFieldsFragment,
  TableDocumentsRowFieldsFragmentDoc,
} from '../../../gql/graphql';
import { EditMiniButton } from '../../common';
import { Amount, Creditor, DateCell, Debtor, Files, Serial, TypeCell, Vat } from './cells';

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
    image
    ... on Invoice {
      documentType
    }
    ... on Proforma {
      documentType
    }
    ... on Receipt {
      documentType
    }
    ... on InvoiceReceipt {
      documentType
    }
  }
`;

/* GraphQL */ `
  query DocumentTableRow($documentId: ID!) {
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

export const DocumentsTableRow = ({ documentData, editDocument }: Props) => {
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
      <Amount data={document} refetchDocument={() => refetchDocument()} />
      <Vat data={document} />
      <TypeCell data={document} />
      <Serial data={document} />
      <Creditor data={document} refetchDocument={() => refetchDocument()} />
      <Debtor data={document} refetchDocument={() => refetchDocument()} />
      <Files data={document} />
      <td>
        <EditMiniButton onClick={editDocument} tooltip="Edit Document" />
      </td>
    </tr>
  );
};
