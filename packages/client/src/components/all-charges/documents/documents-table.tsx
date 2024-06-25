import { ReactElement, useState } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { EditDocumentModal } from '../../common/index.js';
import { DocumentsTableRow, TableDocumentsRowFieldsFragmentDoc } from './documents-table-row.js';

export const TableDocumentsFieldsFragmentDoc = graphql(
  `
    fragment TableDocumentsFields on Charge {
      id
      additionalDocuments {
        id
        ...TableDocumentsRowFields
      }
    }
  `,
  [TableDocumentsRowFieldsFragmentDoc],
);

export function isTableDocumentsFieldsFragmentReady(
  data?: object | FragmentOf<typeof TableDocumentsFieldsFragmentDoc>,
): data is FragmentOf<typeof TableDocumentsFieldsFragmentDoc> {
  if (!!data && 'additionalDocuments' in data) {
    return true;
  }
  return false;
}

type Props = {
  documentsProps: FragmentOf<typeof TableDocumentsFieldsFragmentDoc>;
  onChange: () => void;
};

export const DocumentsTable = ({ documentsProps, onChange }: Props): ReactElement => {
  const { additionalDocuments: documents } = readFragment(
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
          {documents?.map(document => (
            <DocumentsTableRow
              key={document.id}
              documentData={document}
              editDocument={(): void => setEditDocumentId(document.id)}
              onChange={onChange}
            />
          ))}
        </tbody>
      </table>
      <EditDocumentModal
        documentId={editDocumentId}
        onDone={(): void => setEditDocumentId(undefined)}
        onChange={onChange}
      />
    </>
  );
};
