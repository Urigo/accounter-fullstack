import { useState } from 'react';
import { Image } from '@mantine/core';
import gql from 'graphql-tag';
import { useDocumentsQuery } from '../../__generated__/types';
import { AccounterTable } from '../common/accounter-table';
import { Button } from '../common/button';
import { AccounterLoader } from '../common/loader';
import { PopUpModal } from '../common/modal';

gql`
  fragment UnprocessedFields on Unprocessed {
    id
    image
    file
    creditor
    debtor
  }
  fragment InvoiceReceiptFields on Invoice {
    id
    image
    file
    creditor
    debtor
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
    creditor
    debtor
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
    creditor
    debtor
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
    creditor
    debtor
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
    tags {
      name
    }
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
  query Documents {
    documents {
      id
      image
      file
      creditor
      debtor
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

export const DocumentsReport = () => {
  const { data, isLoading } = useDocumentsQuery();
  const [openedImage, setOpenedImage] = useState<string | null>(null);

  return isLoading ? (
    <AccounterLoader />
  ) : (
    <>
      {openedImage && (
        <PopUpModal
          modalSize="45%"
          content={<Image src={openedImage} />}
          opened={Boolean(openedImage)}
          onClose={() => setOpenedImage(null)}
        />
      )}
      <div style={{ fontSize: 40 }}>Documents</div>
      <AccounterTable
        stickyHeader={true}
        items={data?.documents ?? []}
        columns={[
          { title: 'Type', value: doc => doc.__typename },
          {
            title: 'Image',
            value: doc =>
              doc.image ? (
                <button onClick={() => setOpenedImage(doc.image)}>
                  <img alt="missing img" src={doc.image} height={80} width={80} />
                </button>
              ) : (
                'No image'
              ),
          },
          {
            title: 'File',
            value: doc => doc.file && <Button target="_blank" rel="noreferrer" herf={doc.file} title="Open Link" />,
          },
          { title: 'Date', value: doc => ('date' in doc ? doc.date : null) },
          { title: 'Serial Number', value: doc => ('serialNumber' in doc ? doc.serialNumber : null) },
          { title: 'VAT', value: doc => ('vat' in doc ? doc.vat?.formatted : null) },
          { title: 'Amount', value: doc => doc.charge?.transactions[0].amount.formatted ?? null },
          { title: 'Creditor', value: doc => doc.creditor ?? null },
          { title: 'Debtor', value: doc => doc.debtor ?? null },
          {
            title: 'Realted Transaction',
            value: doc =>
              doc.charge?.transactions[0].id ? (
                <AccounterTable
                  items={doc.charge?.transactions ?? []}
                  columns={[
                    {
                      title: 'Transaction Amount',
                      value: transaction => transaction.amount.formatted,
                    },
                    {
                      title: 'Transaction Created At',
                      value: transaction => transaction.createdAt,
                    },
                    {
                      title: 'Transaction Effective Date',
                      value: transaction => transaction.effectiveDate,
                    },
                    {
                      title: 'Transaction Description',
                      value: transaction => transaction.description,
                    },
                  ]}
                />
              ) : (
                'No Realted Transaction'
              ),
          },
        ]}
      />
    </>
  );
};
