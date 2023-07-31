import { useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { TableDocumentsFieldsFragmentDoc } from '../../../gql/graphql';
import { EditDocumentModal, EditMiniButton } from '../../common';
import { Amount, Creditor, DateCell, Debtor, Files, Serial, TypeCell, Vat } from './cells';

/* GraphQL */ `
  fragment TableDocumentsFields on Charge {
    id
    additionalDocuments {
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
  }
`;

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsFieldsFragmentDoc>;
};

export const DocumentsTable = ({ documentsProps }: Props) => {
  const { additionalDocuments: documents } = getFragmentData(
    TableDocumentsFieldsFragmentDoc,
    documentsProps,
  );
  const [editDocumentId, setEditDocumentId] = useState<string | undefined>(undefined);
  return (
    <>
      <table className="w-full h-full">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>VAT</th>
            <th>Type</th>
            <th>Serial</th>
            <th>Creditor</th>
            <th>Debtor</th>
            <th>files</th>
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {documents.map(document => (
            <tr key={document.id}>
              <DateCell data={document} />
              <Amount data={document} />
              <Vat data={document} />
              <TypeCell data={document} />
              <Serial data={document} />
              <Creditor data={document} />
              <Debtor data={document} />
              <Files data={document} />
              <td>
                <EditMiniButton
                  onClick={() => setEditDocumentId(document.id)}
                  tooltip="Edit Document"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EditDocumentModal documentId={editDocumentId} onDone={() => setEditDocumentId(undefined)} />
    </>
  );
};
