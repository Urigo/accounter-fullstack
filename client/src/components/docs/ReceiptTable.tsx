import { FC } from 'react';
import { Table } from '@mantine/core';
import gql from 'graphql-tag';
import { DocumentsInvoiceQuery, DocumentsReceiptQuery, InvoiceFieldsFragment, ReceiptFieldsFragment, useDocumentsInvoiceQuery, useDocumentsReceiptQuery } from '../../__generated__/types';

gql`
fragment ReceiptFields on Receipt {
      id
      image
      file
      vat {
        raw
        formatted
        currency
      }
      serialNumber
      date
},
query documentsReceipt  {
  documents{
    id
    image
    file
    __typename
    ...ReceiptFields
  }
}
`;

function isReceipt (doc: DocumentsReceiptQuery['documents'][number]): doc is ReceiptFieldsFragment {
  return doc.__typename === 'Receipt';
}

export const ReceiptTable: FC = () => {
  const { data, isError, error } = useDocumentsReceiptQuery();
  console.log({ data, isError, error }); // TEST
  const rows = data?.documents.map((doc) => {
    console.log({doc})
    if (isReceipt(doc)) {
      return (
      <tr key={doc.id}>
      <td>{doc.__typename}</td>
      <td>{doc.date}</td>
      <td>{doc.image}</td>
      <td>{doc.serialNumber}</td>
      <td>{doc.vat?.formatted}</td>
      <td>{doc.vat?.currency}</td>
      <td>{doc.vat?.raw}</td>
    </tr>
  )}
   else return null;
  });
  console.log({rows})
  return (
    <>
    <div style={{fontSize: 40}}>Receipt</div>
      <Table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Date</th>
            <th>Image</th>
            <th>Serial Number</th>
            <th>VAT - Formatted</th>
            <th>VAT - Currency</th>
            <th>VAT - Raw</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
};

