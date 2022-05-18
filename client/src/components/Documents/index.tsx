import { Table, Image, SimpleGrid, Loader } from '@mantine/core';
import gql from 'graphql-tag';
import { FC, useState } from 'react';
import {
  ChargeFieldsFragment,
  ChargeFieldsFragmentDoc,
  ChargesFieldsFragment,
  useDocumentsQuery,
} from '../../__generated__/types';
import { PopUpModal } from '../common/Modal';
import { RegularButton } from '../common/Button';

gql`
  fragment UnprocessedFields on Unprocessed {
    id
    image
    file
  }
  fragment InvoiceReceiptFields on Invoice {
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
  fragment ChargeFields on Charge {
    id
    createdAt
    description
    __typename
    tags
    vat {
      formatted
      __typename
    }
    transactions {
      id
      createdAt
      description
      effectiveDate
      amount {
        formatted
        __typename
      }
      userNote
    }
  }
  query documents {
    documents {
      id
      image
      file
      charge {
        ...ChargeFields
      }
      __typename
      ...UnprocessedFields
      ...ProformaFields
      ...ReceiptFields
      ...InvoiceFields
      ...InvoiceReceiptFields
    }
  }
`;

export const DocumentsReport: FC = () => {
  const { data, isLoading } = useDocumentsQuery();
  const [openedImage, setOpenedImage] = useState<string | null>(null);

  const rows = data?.documents.map((doc) => {
    switch (doc.__typename) {
      case 'Unprocessed':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              {doc.image ? (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img src={doc.image} height={80} width={80} />
                </button>
              ) : (
                'No image'
              )}
            </td>
            <td>
              <a href={doc.file} target="_blank">
                <RegularButton title={<>Open Link</>} />
              </a>
            </td>
            {/* TODO: Change "No Data" to respone from server */}
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
              {doc.charge?.transactions[0].id ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Transaction Amount:</th>
                      <th>Chrage VAT:</th>
                      <th>Transaction Created At:</th>
                      <th>Transaction Effective Date:</th>
                      <th>Transaction Description:</th>
                    </tr>
                  </thead>
                  <td>{doc.charge.transactions[0].amount.formatted}</td>
                  <td>{doc.charge.vat?.formatted}</td>
                  <td>{doc.charge.transactions[0].createdAt}</td>
                  <td>{doc.charge.transactions[0].effectiveDate}</td>
                  <td>{doc.charge.transactions[0].description}</td>
                </Table>
              ) : (
                'No Realted Transaction'
              )}
            </td>
          </tr>
        );
      case 'Invoice':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              {doc.image && (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img src={doc.image} height={80} width={80} />
                </button>
              )}
            </td>
            <td>{doc.date}</td>
            <td>{doc.serialNumber}</td>
            <td>{doc.vat?.formatted}</td>
            <td>{doc.amount?.formatted}</td>
            <td>
              {doc.charge?.transactions[0].id ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Transaction Amount:</th>
                      <th>Chrage VAT:</th>
                      <th>Transaction Created At:</th>
                      <th>Transaction Effective Date:</th>
                      <th>Transaction Description:</th>
                    </tr>
                  </thead>
                  <td>{doc.charge.transactions[0].amount.formatted}</td>
                  <td>{doc.charge.vat?.formatted}</td>
                  <td>{doc.charge.transactions[0].createdAt}</td>
                  <td>{doc.charge.transactions[0].effectiveDate}</td>
                  <td>{doc.charge.transactions[0].description}</td>
                </Table>
              ) : (
                'No Realted Transaction'
              )}
            </td>
          </tr>
        );
      case 'InvoiceReceipt':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              {doc.image && (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img src={doc.image} height={80} width={80} />
                </button>
              )}
            </td>
            <td>
              <a href={doc.file} target="_blank">
                <RegularButton title={<>Open Link</>} />
              </a>
            </td>
            {/* TODO: Change "No Data" to respone from server */}
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
              {doc.charge?.transactions[0].id ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Transaction Amount:</th>
                      <th>Chrage VAT:</th>
                      <th>Transaction Created At:</th>
                      <th>Transaction Effective Date:</th>
                      <th>Transaction Description:</th>
                    </tr>
                  </thead>
                  <td>{doc.charge.transactions[0].amount.formatted}</td>
                  <td>{doc.charge.vat?.formatted}</td>
                  <td>{doc.charge.transactions[0].createdAt}</td>
                  <td>{doc.charge.transactions[0].effectiveDate}</td>
                  <td>{doc.charge.transactions[0].description}</td>
                </Table>
              ) : (
                'No Realted Transaction'
              )}
            </td>
          </tr>
        );
      case 'Proforma':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              {doc.image && (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img src={doc.image} height={80} width={80} />
                </button>
              )}
            </td>
            <td>
              <a href={doc.file} target="_blank">
                <RegularButton title={<>Open Link</>} />
              </a>
            </td>
            <td>{doc.date}</td>
            <td>{doc.serialNumber}</td>
            <td>{doc.vat?.formatted}</td>
            <td>{doc.amount?.formatted}</td>
            <td>
              {doc.charge?.transactions[0].id ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Transaction Amount:</th>
                      <th>Chrage VAT:</th>
                      <th>Transaction Created At:</th>
                      <th>Transaction Effective Date:</th>
                      <th>Transaction Description:</th>
                    </tr>
                  </thead>
                  <td>{doc.charge.transactions[0].amount.formatted}</td>
                  <td>{doc.charge.vat?.formatted}</td>
                  <td>{doc.charge.transactions[0].createdAt}</td>
                  <td>{doc.charge.transactions[0].effectiveDate}</td>
                  <td>{doc.charge.transactions[0].description}</td>
                </Table>
              ) : (
                'No Realted Transaction'
              )}
            </td>
          </tr>
        );
      case 'Receipt':
        return (
          <tr key={doc.id}>
            <td>{doc.__typename}</td>
            <td>
              {doc.image && (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img src={doc.image} height={80} width={80} />
                </button>
              )}
            </td>
            <td>
              <a href={doc.file} target="_blank">
                <RegularButton title={<>Open Link</>} />
              </a>
            </td>
            <td>{doc.date}</td>
            <td>{doc.serialNumber}</td>
            <td>{doc.vat?.formatted}</td>
            {/* TODO: Change "No Data" to respone from server */}
            <td>No Data</td>
            <td>
              {doc.charge?.transactions[0].id ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Transaction Amount:</th>
                      <th>Chrage VAT:</th>
                      <th>Transaction Created At:</th>
                      <th>Transaction Effective Date:</th>
                      <th>Transaction Description:</th>
                    </tr>
                  </thead>
                  <td>{doc.charge.transactions[0].amount.formatted}</td>
                  <td>{doc.charge.vat?.formatted}</td>
                  <td>{doc.charge.transactions[0].createdAt}</td>
                  <td>{doc.charge.transactions[0].effectiveDate}</td>
                  <td>{doc.charge.transactions[0].description}</td>
                </Table>
              ) : (
                'No Realted Transaction'
              )}
            </td>
          </tr>
        );
    }
  });
  return (
    <>
      {isLoading ? (
        <a
          style={{
            justifyContent: 'center',
            display: 'flex',
            marginTop: '20%',
          }}
        >
          <Loader color="dark" size="xl" variant="dots" />
        </a>
      ) : (
        <>
          {openedImage && (
            <PopUpModal
              modalSize="45%"
              content={<>{<Image src={openedImage} />}</>}
              opened={openedImage}
              onClose={() => setOpenedImage(null)}
            />
          )}
          <div style={{ fontSize: 40 }}>Documents</div>
          <Table verticalSpacing="lg" striped highlightOnHover>
            <thead>
              <tr>
                <th>Type</th>
                <th>Image</th>
                <th>File</th>
                <th>Date</th>
                <th>Serial Number</th>
                <th>VAT</th>
                <th>Amount</th>
                <th style={{ zIndex: 3 }}>Realted Transaction</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </Table>
        </>
      )}
    </>
  );
};
