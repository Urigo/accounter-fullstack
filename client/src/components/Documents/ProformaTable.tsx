import { FC } from 'react';
import { Table } from '@mantine/core';
import gql from 'graphql-tag';
import {
  DocumentsInvoiceQuery,
  InvoiceFieldsFragment,
  Proforma,
  ProformaFieldsFragment,
  useDocumentsInvoiceQuery,
  useDocumentsProformaQuery,
} from '../../__generated__/types';

gql`
  fragment ProformaFields on Proforma {
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
  }
  query documentsProforma {
    documents {
      id
      image
      file
      __typename
      ...ProformaFields
    }
  }
`;

function isProforma(doc: DocumentsInvoiceQuery['documents'][number]): doc is Proforma {
  return doc.__typename === 'Proforma';
}

export const ProformaTable: FC = () => {
  const { data, isError, error } = useDocumentsProformaQuery();

  const rows = data?.documents.map(doc => {
    console.log({ doc });
    if (isProforma(doc)) {
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
      );
    } else return null;
  });
  console.log({ rows });
  return (
    <>
      <div style={{ fontSize: 40 }}>Proforma</div>
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
