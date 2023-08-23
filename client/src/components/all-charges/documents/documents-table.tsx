import { ReactElement, useState } from 'react';
import { TableDocumentsFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EditDocumentModal } from '../../common';
import { DocumentsTableRow } from './documents-table-row';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsFields on Charge {
    id
    additionalDocuments {
      id
      ...TableDocumentsRowFields
    }
  }
`;

type Props = {
  documentsProps: FragmentType<typeof TableDocumentsFieldsFragmentDoc>;
};

export const DocumentsTable = ({ documentsProps }: Props): ReactElement => {
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
            <DocumentsTableRow
              key={document.id}
              documentData={document}
              editDocument={(): void => setEditDocumentId(document.id)}
            />
          ))}
        </tbody>
      </table>
      <EditDocumentModal
        documentId={editDocumentId}
        onDone={(): void => setEditDocumentId(undefined)}
      />
    </>
  );
};
