import { Table, Image } from '@mantine/core';
import gql from 'graphql-tag';
import { FC } from 'react';
import { useDocumentsQuery } from '../../__generated__/types';
import { useState } from 'react';
import { Drawer, Button, Group } from '@mantine/core';
import { PopUpModal } from '../common/Modal';

gql`
  fragment UnprocessedFields on Unprocessed {
    id
    image
    file
  }
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
  }
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
  }
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
  query documents {
    documents {
      id
      image
      file
      __typename
      ...UnprocessedFields
      ...ProformaFields
      ...ReceiptFields
      ...InvoiceFields
    }
  }
`;

export const DocumentsReport: FC = () => {
  const { data, isError, error } = useDocumentsQuery();
  const rows = data?.documents.map((doc) => {
    switch (doc.__typename) {
      case 'Unprocessed':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              <PopUpModal
                modalSize="45%"
                ButtonDisplay={
                  <Image width={80} height={80} src={doc.image} alt="image" />
                }
                content={<Image src={doc.image} alt="image" />}
              />
            </td>
            <td>{doc.file}</td>
          </tr>
        );
      case 'Invoice':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              <PopUpModal
                modalSize="45%"
                ButtonDisplay={
                  <Image width={80} height={80} src={doc.image} alt="image" />
                }
                content={<Image src={doc.image} alt="image" />}
              />
            </td>
            <td>{doc.file}</td>
            <td>{doc.date}</td>
            <td>{doc.serialNumber}</td>
            <td>{doc.vat?.currency}</td>
            <td>{doc.vat?.formatted}</td>
            <td>{doc.vat?.raw}</td>
            <td>{doc.amount?.currency}</td>
            <td>{doc.amount?.formatted}</td>
            <td>{doc.amount?.raw}</td>
          </tr>
        );
        case 'Proforma':
          return (
            <tr key={doc.id}>
              <td>{doc.__typename}</td>
              <td>
                <PopUpModal
                  modalSize="45%"
                  ButtonDisplay={
                    <Image width={80} height={80} src={doc.image} alt="image" />
                  }
                  content={<Image src={doc.image} alt="image" />}
                />
              </td>
              <td>{doc.file}</td>
              <td>{doc.date}</td>
              <td>{doc.serialNumber}</td>
              <td>{doc.vat?.currency}</td>
              <td>{doc.vat?.formatted}</td>
              <td>{doc.vat?.raw}</td>
              <td>{doc.amount?.currency}</td>
              <td>{doc.amount?.formatted}</td>
              <td>{doc.amount?.raw}</td>
            </tr>
          );
          case 'Receipt':
            return (
              <tr key={doc.id}>
                <td>{doc.__typename}</td>
                <td>
                  <PopUpModal
                    modalSize="45%"
                    ButtonDisplay={
                      <Image width={80} height={80} src={doc.image} alt="image" />
                    }
                    content={<Image src={doc.image} alt="image" />}
                  />
                </td>
                <td>{doc.file}</td>
                <td>{doc.date}</td>
                <td>{doc.serialNumber}</td>
                <td>{doc.vat?.currency}</td>
                <td>{doc.vat?.formatted}</td>
                <td>{doc.vat?.raw}</td>
              </tr>
            );
    }
  });
  return (
    <>
      <div style={{ fontSize: 40 }}>Documents</div>
      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>Type</th>
            <th>Image</th>
            <th>File</th>
            <th>Date</th>
            <th>Serial Number</th>
            <th>VAT - Currency</th>
            <th>VAT - Formatted</th>
            <th>VAT - Raw</th>
            <th>Amount - Currency</th>
            <th>Amount - Formatted</th>
            <th>Amount - Raw</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
};
