import { FC } from 'react';
import { Table } from '@mantine/core';
import gql from 'graphql-tag';
import { DocumentsInvoiceQuery, InvoiceFieldsFragment, useDocumentsInvoiceQuery } from '../../__generated__/types';

gql`
fragment InvoiceFields on Invoice {
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
      amount {
        raw
        formatted
        currency
      }
},
query documentsInvoice  {
  documents{
    id
    image
    file
    __typename
    ...InvoiceFields
  }
}
`;

function isInvoice (doc: DocumentsInvoiceQuery['documents'][number]): doc is InvoiceFieldsFragment {
  return doc.__typename === 'Invoice';
}

export const InvoiceTable: FC = () => {
  const { data, isError, error } = useDocumentsInvoiceQuery();

  const rows = data?.documents.map((doc) => {
    console.log({doc})
    if (isInvoice(doc)) {
      return (
      <tr key={doc.id}>
      <td>{doc.__typename}</td>
      <td>{doc.date}</td>
      <td>{doc.image}</td>
      <td>{doc.serialNumber}</td>
      <td>{doc.vat?.formatted}</td>
      <td>{doc.vat?.currency}</td>
      <td>{doc.vat?.raw}</td>
      <td>{doc.amount?.currency}</td>
      <td>{doc.amount?.formatted}</td>
      <td>{doc.amount?.raw}</td>
    </tr>
  )}
   else return null;
  });
  console.log({rows})
  return (
    <>
    <div style={{fontSize: 40}}>Invoice</div>
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
            <th>Amount - Formatted</th>
            <th>Amount - Currency</th>
            <th>Amount - Raw</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
};

