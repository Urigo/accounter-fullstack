import { FC } from 'react';
import { Table } from '@mantine/core';
import gql from 'graphql-tag';
import { DocumentsInvoiceQuery, DocumentsUnprocessedQuery, InvoiceFieldsFragment, UnprocessedFieldsFragment, useDocumentsInvoiceQuery, useDocumentsUnprocessedQuery } from '../../__generated__/types';

gql`
fragment UnprocessedFields on Unprocessed {
    id
    image
    file
},
query documentsUnprocessed {
  documents{
    id
    image
    file
    __typename
    ...UnprocessedFields
  }
}
`;

function isUnprocessed (doc: DocumentsUnprocessedQuery['documents'][number]): doc is UnprocessedFieldsFragment {
  return doc.__typename === 'Unprocessed';
}

export const UnprocessedTable: FC = () => {
  const { data, isError, error } = useDocumentsUnprocessedQuery();
  console.log({ data, isError, error }); // TEST
  const rows = data?.documents.map((doc) => {
    console.log({doc})
    if (isUnprocessed(doc)) {
      return (
      <tr key={doc.id}>
      <td>{doc.__typename}</td>
      <td>{doc.image}</td>
      <td>{doc.file}</td>
    </tr>
  )}
   else return null;
  });
  console.log({rows})
  return (
    <>
    <div style={{fontSize: 40}}>Unprocessed</div>
      <Table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Image</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
};

