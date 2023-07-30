import { useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { TableDocumentsFieldsFragmentDoc } from '../../../gql/graphql';
import { EditMiniButton, EditTransactionModal } from '../../common';
import {
  Account,
  Amount,
  Counterparty,
  DebitDate,
  Description,
  EventDate,
  SourceID,
} from './cells';

/* GraphQL */ `
  fragment TableDocumentsFields on Charge {
    id
    additionalDocuments {
      ...EditDocumentFields
      id
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
            <th>Event Date</th>
            <th>Debit Date</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Description</th>
            <th>Reference#</th>
            <th>Counterparty</th>
            {/* <th>Activity Type</th> // TODO: implement */}
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {documents.map(document => (
            <tr key={document.id}>
              <EventDate data={document} />
              <DebitDate data={document} />
              <Amount data={document} />
              <Account data={document} />
              <Description data={document} />
              <SourceID data={document} />
              <Counterparty data={document} />
              <td>
                <EditMiniButton onClick={() => setEditDocumentId(document.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EditTransactionModal transactionID={editDocumentId} setEditTransaction={setEditDocumentId} />
    </>
  );
};
